import {
  JSCodeshift,
  ObjectMethod,
  ObjectProperty,
  Property,
  SpreadElement,
  SpreadProperty,
} from "jscodeshift";
import { logManualWork } from "../../logger";
import { cssTONativeBaseProps } from "./css-to-nb-props";
import { elementArray } from "../utils/mappings";

export function convertObjectProperties(
  nodeName: string,
  filePath: string,
  j: JSCodeshift,
  properties: Array<
    Property | ObjectProperty | SpreadElement | SpreadProperty | ObjectMethod
  >,
): Array<ObjectProperty | SpreadElement> {
  const activeElement = elementArray.find(
    (a) => a.to === nodeName || a.from === nodeName,
  );
  const { cssMap, spreadIdentifiers } = reduceASTToCssObject(properties);

  const newCss = cssTONativeBaseProps(cssMap);

  return Object.entries(newCss)
    .map(([key, value]) => {
      return j.objectProperty(
        j.identifier(key),
        typeof value === "string" ? j.stringLiteral(value) : j.literal(value),
      );
    })
    .concat(
      ...spreadIdentifiers.reduce((props, node) => {
        const spreadName =
          node.argument.type === "Identifier"
            ? node.argument.name
            : // is it ever not an identifier?
              "UNKNOWN_IDENTIFIER";

        logManualWork({
          filePath,
          helpfulMessage: `The codemod for handling inline style props found a style attribute with an object spread into it.
  We are unable to verify that this spread object contains entirely valid CSS for react native.

  The manual effort here is to track down the variable and verify/change all instances to ensure they are react native compatible.

  For example, if the \`${spreadName}\` variable is an import, follow the import (and its respective brand overrides), and verify all of the keys are react native compatible.

  If the \`${spreadName}\` variable is a prop coming in from the parent, find all usages of this component, and ensure the prop passed in is valid react native styles.`,
          startingLine: node.loc.start.line,
          endingLine: node.loc.end.line,
        });

        props.push(
          // @ts-ignore
          j.commentLine(
            " TODO: RN - Verify spread does not include invalid props or styles",
          ),
          node,
        );
        return props;
      }, []),
    );
}

function reduceASTToCssObject(
  properties: Array<
    Property | ObjectProperty | SpreadElement | SpreadProperty | ObjectMethod
  >,
) {
  const spreadIdentifiers = [];
  const cssMap = properties.reduce((properties, node) => {
    if (
      node.type === "ObjectProperty" &&
      node.key.type === "Identifier" &&
      node.value.type === "StringLiteral"
    ) {
      properties[node.key.name] = node.value.value;
    } else if (node.type === "SpreadElement") {
      spreadIdentifiers.push(node);
    } else {
      throw new Error(
        `Unexpected node type in object of style prop ${node.type}`,
      );
    }

    return properties;
  }, {} as Record<string, any>);

  return { cssMap, spreadIdentifiers };
}
