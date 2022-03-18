import toRN from "css-to-react-native";

function handleUnsupportedProperty(root, property, value) {
  root[`// TODO: RN - Unsupported Property. ${property}`] = value;
}

const dropCss = () => {};

function handlePaddingOrMargin(
  root: Object,
  value: string,
  property: "padding" | "margin",
) {
  Object.entries(toRN([[property, value]])).forEach(([key, value]) => {
    root[key] = value;
  });
}

function withToRN(property) {
  return (root, value) => {
    if (value.includes("substitution")) {
      root[property] = value;
    } else {
      root[property] = toRN([[property, value]])[property];
    }
  };
}

function hoistTo(parentKey: string, property: string) {
  return (root, value) => {
    root[parentKey] = root[parentKey] || {};
    root[parentKey][property] = value;
  };
}

const mapping = {
  // if the node had flex, we need to make sure its either set to something
  // or forced to row.
  display: (root, value) => {
    if (value === "flex") {
      root.flexDirection = root.flexDirection || "row";
      return;
    }

    if (value === "none") {
      root.display = "none";
      return;
    }

    // Just drop the block displays.
    if (value === "block") {
      return;
    }

    // any other displays (grid, etc) - handle as unsupported
    return handleUnsupportedProperty(root, "display", value);
  },

  position: (root, value) => {
    if (value === "absolute") {
      root.position = value;
      return;
    }
    if (value === "relative") {
      return;
    }
    return handleUnsupportedProperty(root, "display", value);
  },

  // accept the values - no remapping needed.
  alignItems: withToRN("alignItems"),
  alignSelf: withToRN("alignSelf"),
  justifyContent: withToRN("justifyContent"),
  zIndex: withToRN("zIndex"),
  height: withToRN("height"),
  width: withToRN("width"),
  backgroundColor: withToRN("backgroundColor"),
  opacity: withToRN("opacity"),
  textAlign: withToRN("textAlign"),
  border: withToRN("border"),
  flex: withToRN("border"),
  marginTop: withToRN("marginTop"),
  marginRight: withToRN("marginTop"),

  padding: (root, value) => handlePaddingOrMargin(root, value, "padding"),
  margin: (root, value) => handlePaddingOrMargin(root, value, "margin"),

  // Unsupported properties:
  objectFit: (root, value) =>
    handleUnsupportedProperty(root, "objectFit", value),

  // properties to straight up drop
  animation: dropCss,
  transition: dropCss,
  transform: dropCss,

  outline: hoistTo("_web", "outline"),
  textDecoration: hoistTo("_text", "textDecoration"),
};

export function cssTONativeBaseProps(
  css: Record<string, any>,
): Record<string, any> {
  const newCss = {} as Record<string, any>;

  Object.entries(mapping).forEach(([property, processor]) => {
    if (css[property]) {
      processor(newCss, css[property]);
    }
  });

  return newCss;
}
