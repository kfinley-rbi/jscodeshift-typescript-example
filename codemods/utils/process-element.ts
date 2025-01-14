import { JSCodeshift } from 'jscodeshift';
import { IElementMapping, mediaPropertyNames, preToRNTransform } from './mappings';
import * as _ from 'lodash/fp';
import * as postcss from 'postcss-scss';
import * as postcssJs from 'postcss-js';
import toRN from '../css-to-react-native';
import { logManualWork } from '../../logger';
import {
  addProperties,
  addProperty,
  convertCssObject,
  needsFlexRemapping,
} from './convert-css-object';

const TODO_RN_COMMENT = `TODO: RN - unsupported CSS`;

const tagTypes = {
  Identifier: node => node,
  CallExpression: node => node.callee,
  MemberExpression: node => node.object,
};

const SHOULD_THROW_ON_CONVERSION_ISSUES = false;

export const processElement = ({
  j,
  filePath,
  nodePath,
  activeElement,
  addToImports,
  addToUCLImportsFn,
  asObject = false,
  includeTypes = true,
  localImportNames = [],
}: {
  j: JSCodeshift;
  filePath: string;
  nodePath: any;
  activeElement: IElementMapping;
  addToImports: boolean;
  addToUCLImportsFn: Function;
  asObject?: boolean;
  includeTypes?: boolean;
  localImportNames?: string[];
}) => {
  const componentNameOrAlias = addToImports
    ? addToUCLImportsFn(activeElement.to)
    : activeElement.to;

  const { quasi, tag } = nodePath.node;
  const { obj, cssText, substitutionMap, comments, hasParsingError } = parseTemplate({
    quasi,
    tag,
  });
  let { properties, localVars, hasExpressionError } = convertCssObject({
    j,
    obj,
    activeElement,
    substitutionMap,
    localImportNames,
  });
  let hasBailingError = hasExpressionError || hasParsingError;
  const addToLocalVars = v => localVars.push(v);

  if (comments.length) {
    comments.forEach((c, i) => {
      // Expressions at the property level will appear as comments
      const exp = substitutionMap[`/*${c.text}*/`];
      if (exp) {
        // is the expression is an variable, spread it.
        // @ts-ignore
        if (exp.type === 'Identifier') {
          properties = [
            ...properties,
            // @ts-ignore
            j.spreadElement(j.identifier(exp.name)),
          ];
        }

        const { obj, substitutionMap } = parseTemplate({
          // @ts-ignore
          quasi: exp.quasi,
          // @ts-ignore
          tag: exp.tag,
        });
        if (!obj) return;

        _.keys(obj).forEach(k => {
          let v = obj[k];
          // In the case media queries we want to turn the property into
          // an object, so the parent is the original key, e.g. `margin:`
          // const parent = k;
          // Set the new key based on the media query
          // @ts-ignore
          const queryName = exp.tag.property.name;
          // e.g. `mobile` `desktop`
          const { origProp, newProp } = mediaPropertyNames[queryName];
          if (!origProp) {
            return;
          }

          const { identifier, isRemovable, isSupported, isSkipable, value } = preToRNTransform(
            k,
            v,
            obj
          );
          k = identifier;
          v = value;
          if (isRemovable) {
            return;
          }
          if (!isSupported && !isSkipable) {
            try {
              properties = addProperty(j, properties, k, v, isSupported, substitutionMap);
              return;
            } catch (e) {
              hasBailingError = true;
            }
          }

          // Convert
          let convertedObj;
          try {
            if (isSkipable) {
              convertedObj = { [k]: v };
            } else {
              convertedObj = toRN([[k, v]]);
            }
          } catch (error) {
            console.error('toRN', k, v, error.message);
            hasBailingError = true;
          }
          try {
            _.keys(convertedObj).forEach(k => {
              const v = convertedObj[k];
              properties = addProperties({
                j,
                properties,
                substitutionMap,
                addToLocalVars,
                identifier: k,
                initialValue: v,
                parent: k,
                newPropertyName: newProp,
                originalPropertyNewName: origProp,
                needsFlexRemapping: needsFlexRemapping(obj),
                localImportNames,
              });
            });
          } catch (error) {
            console.error('addProperties', convertedObj, error.message);
            hasBailingError = true;
          }
        });
        // Return so that comment is not added to the object
        return;
      }

      // Get the position adjusted for the fact that
      // comments have been removed from the `properties` array
      const position = c.position - i;
      // Check to see if there is a comment at this lin
      const p = properties[position];
      const comment =
        c.text.indexOf('\n') >= 0
          ? j.commentBlock(' ' + c.text + '\n', true, true)
          : j.commentLine(' ' + c.text, true);
      if (p) {
        p.comments = [comment];
      }
    });
  }

  let asObjectOrFunction;

  if (localVars.length) {
    asObjectOrFunction = j.arrowFunctionExpression(
      [j.identifier('p')],
      j.parenthesizedExpression(j.objectExpression(properties)),
      false
    );
  } else {
    asObjectOrFunction = j.objectExpression(properties);
  }

  let exprs;

  if (asObject) {
    exprs = asObjectOrFunction;
  } else {
    exprs = j.callExpression(
      j.memberExpression(j.identifier(componentNameOrAlias), j.identifier('withConfig')),
      [asObjectOrFunction]
    );
  }

  if (hasBailingError) {
    // Don't try to convert
    if (SHOULD_THROW_ON_CONVERSION_ISSUES) {
      throw new Error('Unable to convert');
    }
    let ct = cssText;
    _.map((k: string) => {
      try {
        // Try to get a nice string
        ct = nodePathToString(nodePath);
      } catch (error) {
        console.log(`Comment extraction error: `, error);
      }
    })(_.keys(substitutionMap));
    ct = _.flow(_.replace('/*', '//'), _.replace('*/', ''))(ct);
    logManualWork({
      filePath,
      helpfulMessage: `
The codemod for handling styled-components was not able to convert this element.

It can fail for a few reasons:
- Unsupported attributes
- Nested attributes
- Complex logic

The unsupported element:

\`\`\`tsx
${ct}
\`\`\`
`,
      startingLine: nodePath.node.loc.start.line,
      endingLine: nodePath.node.loc.end.line,
    });
    const comment = `
${TODO_RN_COMMENT}
Some attributes were not converted.

${ct}
`;
    exprs.comments = [j.commentBlock(comment, false, true)];
  }

  // Insert comments above the JSX Node
  if (activeElement.insertComments) {
    exprs.comments = exprs.comments || [];
    exprs.comments.push(j.commentBlock(` TODO: RN - ${activeElement.insertComments}`, false, true));
    logManualWork({
      filePath,
      helpfulMessage: `The codemod for renaming JSX primitives (<${activeElement.from}> to <${activeElement.to}>) had some uncertainty.`,
      startingLine: nodePath.parentPath.node.loc.start.line,
      endingLine: nodePath.parentPath.node.loc.end.line,
    });
  }
  // Map Types
  if (includeTypes) {
    try {
      exprs.typeArguments = j.tsTypeParameterInstantiation([getTypeParameter(nodePath, j)]);
    } catch (e) {}
  }
  return exprs;
};

const parseTemplate = ({ quasi, tag }) => {
  // Nested expressions
  if (!tag?.type) return {};

  if (!(tag.type in tagTypes)) return {};

  // Get the identifier for styled in either styled.View`...` or styled(View)`...`
  // Note we aren't checking the name of the callee
  const callee = tagTypes[tag.type](tag);

  if (callee.type !== 'Identifier') return;

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
  let root;
  try {
    root = postcss.parse(cssText, {
      map: { annotation: false },
    });
  } catch (e) {
    return {
      hasParsingError: true,
      cssText,
      obj: {},
      substitutionMap,
      comments: [],
    };
  }

  const comments = [];
  const notInPropertiesIndexes = {};
  root.walkComments((comment, position) => {
    comments.push({ text: comment.text, position });
    const index = substitutionNames.indexOf(`/*${comment.text}*/`);
    if (index >= 0) notInPropertiesIndexes[index] = true;
  });

  substitutionNames.forEach((name, index) => {
    if (!notInPropertiesIndexes[index])
      substitutionNames[index] = name.replace(/^\/\*(.+)\*\/$/, '$1');
  });
  cssText =
    quasis[0].value.cooked +
    substitutionNames.map((name, index) => name + quasis[index + 1].value.cooked).join('');
  // @ts-ignore
  substitutionMap = _.fromPairs(_.zip(substitutionNames, expressions));

  root = postcss.parse(cssText);

  const obj = postcssJs.objectify(root);
  return {
    hasParsingError: false,
    cssText,
    obj,
    substitutionMap,
    comments,
  };
};

const nodePathToString = nodePath => {
  if (nodePath?.node?.loc) {
    try {
      const start = nodePath?.node?.loc?.start?.line - 1;
      const end = nodePath?.node?.loc?.end?.line + 1;
      const str = _.flow(
        _.slice(start, end),
        // @ts-ignore
        _.map(o => o?.line),
        _.map((o: string) => _.flow(_.replace('/*', '//'), _.replace('*/', ''), _.trimEnd)(o)),
        _.join('\n')
      )(nodePath?.node?.loc?.lines?.infos);
      return str;
    } catch (error) {
      throw new Error(`nodePathToString error`);
    }
  }
  return 'And error occurred';
};

// tries to grab the type parameter from `styled.div<foo>` if it can
function getTypeParameter(nodePath: any, j: JSCodeshift) {
  const typeParameters = nodePath.node.typeParameters;
  const typeRef = typeParameters?.params[0];

  return typeRef;
}
