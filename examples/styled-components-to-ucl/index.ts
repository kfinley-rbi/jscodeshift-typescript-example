import { API, FileInfo, JSCodeshift } from 'jscodeshift';
import { parseExpression, getElementMapping } from './utils';
import * as _ from 'lodash/fp';
import * as postcss from "postcss-scss";
import * as postcssJs from "postcss-js";
import toRN from "css-to-react-native";

export const SpreadContentContainer = `
  font-size: 1.1rem;
  text-align: center;
`;


const tagTypes = {
  Identifier: node => node,
  CallExpression: node => node.callee,
  MemberExpression: node => node.object,
};

// const importSpecifiers = ['ImportDefaultSpecifier', 'ImportSpecifier'];

export const parser = 'tsx'
export default function transformer(fileInfo: FileInfo, api: API) {
  const j = api.jscodeshift;

  const root = j(fileInfo.source);
  const uclImports = [];

  const styledImport = root
    .find(j.ImportDeclaration, {
      source: {
        value: 'styled-components'
      }
    });

  if (!styledImport.length) {
    console.log(`${fileInfo.path}  doesn\'t contain styled-components`);
    return;
  }

  // other imports from styled-components
  // e.g. `css` `animate`
  const otherImports = styledImport.get(0).node.specifiers
    .filter(p => p.type === 'ImportSpecifier')
    .map(p => p.imported.name);


  if (otherImports.length) {

  }

  // Find the methods that are being called.

  // Collect deps
  // const elementsUsed = [];

  // check to see if we are importing css
  let styledLocal = styledImport.find(j.Identifier).get(0).node.name;

  root.find(j.MemberExpression, {
    object: {
      name: styledLocal,
    },
  })
    .closest(j.TaggedTemplateExpression)
    .forEach(nodePath => {
      // @ts-ignore
      const elementPropName = nodePath.node.tag.property.name;
      // styled.XXX
      // @ts-ignore
      const activeElement = getElementMapping(elementPropName);
      processFile(j, nodePath, activeElement, true, uclImports);
    });

  root.find(j.CallExpression, {
    callee: {
      name: styledLocal,
    }
  })
    .closest(j.TaggedTemplateExpression)
    .forEach(nodePath => {
      const { node } = nodePath;
      // @ts-ignore
      const nameOfArg = node.tag?.arguments[0]?.name;
      processFile(j, nodePath, { component: nameOfArg }, false, uclImports);
    });

  // Imports
  // -------
  // Remove the 'styled-components' import
  styledImport.remove();

  // Replace Import with UCL
  styledImport.insertBefore(j.importDeclaration(
    // All imports on the page
    _.flow(
      // dedupe
      _.uniq,
      _.map((name: string) => j.importSpecifier(
        j.identifier(name),
      )),
      _.values,
    )(uclImports),
    j.stringLiteral("@rbilabs/universal-components")
  ))

  return root.toSource({ quote: 'single' });
};

const processFile = (j: JSCodeshift, nodePath, activeElement, addToImports, uclImports) => {
  const { quasi, tag } = nodePath.node
  if (!(tag.type in tagTypes)) return;

  // Get the identifier for styled in either styled.View`...` or styled(View)`...`
  // Note we aren't checking the name of the callee
  const callee = tagTypes[tag.type](tag);

  if (callee.type !== 'Identifier') return;

  if (activeElement?.component && addToImports) uclImports.push(activeElement.component)

  const { quasis, expressions } = quasi;
  // Substitute all ${interpolations} with arbitrary test that we can find later
  // This is so we can shove it in postCSS
  const substitutionNames = expressions.map((_value, index) => `/*__${index}substitution__*/`);
  let cssText =
    quasis[0].value.cooked +
    substitutionNames.map((name, index) => name + quasis[index + 1].value.cooked).join('');
  // @ts-ignore
  let substitutionMap = _.fromPairs(_.zip(substitutionNames, expressions));

  // Replace mixin interpolations as comments, but as ids if in properties
  let root = postcss.parse(cssText, {
    map: { annotation: false }
  });

  const comments = [];
  const notInPropertiesIndexes = {};
  root.walkComments((comment, position) => {
    comments.push({ text: comment.text, position });
    const index = substitutionNames.indexOf(`/*${comment.text}*/`);
    if (index >= 0) notInPropertiesIndexes[index] = true;
  });

  substitutionNames.forEach((name, index) => {
    if (!notInPropertiesIndexes[index]) substitutionNames[index] = name.replace(/^\/\*(.+)\*\/$/, '$1');
  });
  cssText =
    quasis[0].value.cooked +
    substitutionNames.map((name, index) => name + quasis[index + 1].value.cooked).join('');
  // @ts-ignore
  substitutionMap = _.fromPairs(_.zip(substitutionNames, expressions));

  root = postcss.parse(cssText);
  // root.walkDecls((decl) => {
  //   console.log(`decl.prop: `, decl.prop);
  //   console.log(`decl.value: `, decl.value);
  //   const testProp = decl.prop.replace(/-/g, '').toLowerCase();
  //   const obj = toRN([[decl.prop, decl.value]]);
  //   // @ts-ignore
  //   decl.prop = _.keys(obj)[0];
  //   const prop = _.keys(obj)[0];
  //   decl.value = obj[prop] as string;
  // });

  const obj = postcssJs.objectify(root);

  let localVars = [];
  const properties = _.map((key: string) => {
    const initialValue = obj[key];
    console.log(`>>>>>> key: `, key);
    const convertedObj = toRN([[key, initialValue]]);
    console.log(`>>>>>> convertedObj: `, convertedObj);
    const property = _.keys(convertedObj)[0];
    let identifier = key;
    if (key === 'font') {
      identifier = 'variant';
    }


    // If the value is is an expression
    const foundExpression = substitutionMap[initialValue];
    let value;
    // console.log(`>>>>>> foundExpression: `, foundExpression);

    if (foundExpression) {
      const parsed = parseExpression(j, foundExpression);

      value = parsed.value;
      // These are variables that are used in Arrow functions
      if (parsed.vars?.length) {
        localVars.push(parsed.vars);
      }
    } else {
      value = j.literal(convertedObj[property] as string);
    }

    const p = j.property(
      'init',
      j.identifier(identifier as string),
      value,
    );
    return p;
  })(_.keys(obj));

  let asObjectOrFunction;
  if (comments.length) {
    comments.forEach((c, i) => {
      // Get the position adjusted for the fact that
      // comments have been removed from the `properties` array
      const position = c.position - i;
      // Check to see if there is a comment at this lin
      const p = properties[position];
      const comment = c.text.indexOf("\n") >= 0
        ? j.commentBlock(' ' + c.text + '\n', true, true)
        : j.commentLine(' ' + c.text, true);
      // console.log(`>> c: `, c);
      // console.log(`>> comment: `, comment);
      // console.log(`>> p: `, p);
      // if (p?.comments) {
      p.comments = [comment];
      // }
    })
  }
  if (localVars.length) {
    asObjectOrFunction = j.arrowFunctionExpression(
      [j.identifier('p')],
      j.parenthesizedExpression(j.objectExpression(properties)),
      false,
    );
  } else {
    asObjectOrFunction = j.objectExpression(properties);
  }

  const exprs = j.callExpression(
    j.memberExpression(
      j.identifier(activeElement.component),
      j.identifier('withConfig'),
    ),
    [asObjectOrFunction],
  );

  // Map Types
  if (localVars.length) {
    // Add types
    // @ts-ignore
    exprs.typeArguments = j.tsTypeParameterInstantiation([
      j.tsTypeLiteral(
        _.flow(
          _.flatten,
          _.uniqBy('name'),
          _.map((v: any) => j.tsPropertySignature(
            j.identifier(v.name),
            j.tsTypeAnnotation(v.type),
          ))
        )(localVars)
      ),
    ]);
  }
  j(nodePath).replaceWith(exprs);
  return;
}