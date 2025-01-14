'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

function _interopDefault(ex) {
  return ex && typeof ex === 'object' && 'default' in ex ? ex['default'] : ex;
}

var parse = require('postcss-value-parser');

var parse__default = _interopDefault(parse);

var camelizeStyleName = _interopDefault(require('camelize'));

var cssColorKeywords = _interopDefault(require('css-color-keywords'));

var matchString = function matchString(node) {
  if (node.type !== 'string') return null;
  return node.value
    .replace(/\\([0-9a-f]{1,6})(?:\s|$)/gi, function (match, charCode) {
      return String.fromCharCode(parseInt(charCode, 16));
    })
    .replace(/\\/g, '');
};

var hexColorRe = /^(#(?:[0-9a-f]{3,4}){1,2})$/i;
var cssFunctionNameRe = /^(rgba?|hsla?|hwb|lab|lch|gray|color)$/;

var matchColor = function matchColor(node) {
  if (
    node.type === 'word' &&
    (hexColorRe.test(node.value) || node.value in cssColorKeywords || node.value === 'transparent')
  ) {
    return node.value;
  } else if (node.type === 'function' && cssFunctionNameRe.test(node.value)) {
    return parse.stringify(node);
  }

  return node.value;
};

var noneRe = /^(none)$/i;
var autoRe = /^(auto)$/i;
var identRe = /(^-?[_a-z][_a-z0-9-]*$)/i; // Note if these are wrong, you'll need to change index.js too

var numberRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)$/i; // Note lengthRe is sneaky: you can omit units for 0

var lengthRe = /^(0$|(?:[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)(?=px$))/i;
var unsupportedUnitRe =
  /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(ch|em|ex|rem|vh|vw|vmin|vmax|cm|mm|in|pc|pt))$/i;
var angleRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(?:deg|rad))$/i;
var percentRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?%)$/i;

var noopToken = function noopToken(predicate) {
  return function (node) {
    return predicate(node) ? '<token>' : null;
  };
};

var valueForTypeToken = function valueForTypeToken(type) {
  return function (node) {
    return node.type === type ? node.value : null;
  };
};

var regExpToken = function regExpToken(regExp, transform) {
  if (transform === void 0) {
    transform = String;
  }

  return function (node) {
    if (node.type !== 'word') return null;
    var match = node.value.match(regExp);
    if (match === null) return null;
    var value = transform(match[1]);
    return value;
  };
};

var SPACE = noopToken(function (node) {
  return node.type === 'space';
});
var SLASH = noopToken(function (node) {
  return node.type === 'div' && node.value === '/';
});
var COMMA = noopToken(function (node) {
  return node.type === 'div' && node.value === ',';
});
var SUB_VAR = regExpToken(/^((.*?)(substitution)(.*?))$/i);
var WORD = valueForTypeToken('word');
var NONE = regExpToken(noneRe);
var AUTO = regExpToken(autoRe);
var NUMBER = regExpToken(numberRe, Number);
var LENGTH = regExpToken(lengthRe, Number);
var UNSUPPORTED_LENGTH_UNIT = regExpToken(unsupportedUnitRe);
var ANGLE = regExpToken(angleRe, function (angle) {
  return angle.toLowerCase();
});
var PERCENT = regExpToken(percentRe);
var IDENT = regExpToken(identRe);
var STRING = matchString;
var COLOR = matchColor;
var LINE = regExpToken(/^(none|underline|line-through)$/i);
var BORDER_STYLE = regExpToken(/^(solid|dashed|dotted)$/);
var SUB_VAR$1 = regExpToken(/^((.*?)(substitution)(.*?))$/);
var defaultBorderWidth = 1;
var defaultBorderColor = 'black';
var defaultBorderStyle = 'solid';

var border = function border(prefix) {
  if (prefix === void 0) {
    prefix = '';
  }

  return function (tokenStream) {
    var _ref;

    var borderWidth;
    var borderColor;
    var borderStyle;

    if (tokenStream.matches(NONE)) {
      tokenStream.expectEmpty();
      return {
        borderWidth: 0,
        borderColor: 'black',
        borderStyle: 'solid',
      };
    }

    var partsParsed = 0;

    while (partsParsed < 3 && tokenStream.hasTokens()) {
      if (partsParsed !== 0) tokenStream.expect(SPACE);

      if (borderWidth === undefined && tokenStream.matches(LENGTH, UNSUPPORTED_LENGTH_UNIT)) {
        borderWidth = tokenStream.lastValue;
      } else if (borderStyle === undefined && tokenStream.matches(BORDER_STYLE)) {
        borderStyle = tokenStream.lastValue;
      } else if (
        borderColor === undefined &&
        (tokenStream.matches(COLOR) || tokenStream.matches(SUB_VAR$1))
      ) {
        borderColor = tokenStream.lastValue;
      } else {
        tokenStream['throw']();
      }

      partsParsed += 1;
    }

    tokenStream.expectEmpty();
    if (borderWidth === undefined) borderWidth = defaultBorderWidth;
    if (borderColor === undefined) borderColor = defaultBorderColor;
    if (borderStyle === undefined) borderStyle = defaultBorderStyle;
    return (
      (_ref = {}),
      (_ref['border' + prefix + 'Width'] = borderWidth),
      (_ref['border' + prefix + 'Color'] = borderColor),
      (_ref['borderStyle'] = borderStyle),
      _ref
    );
  };
};
/* eslint-disable prefer-destructuring */

/* eslint-disable no-restricted-globals */

var numberOrLengthRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)((?:px|rem))?$/i;
var subRe = /^(.*?)(substitution)(.*?)/i;

var parseValue = function parseValue(value, convertToNB) {
  if (String(value).match(subRe)) {
    return value;
  }

  var v = value;
  var p = String(value).match(numberOrLengthRe);

  if (p && p[1]) {
    // Convert rem to pixel
    if (p[2] === 'rem') {
      var asNum = parseFloat(String(p[1]), 10);

      if (!isNaN(asNum)) {
        v = Math.floor(asNum * 16);
      }
    } else {
      v = parseFloat(p[1], 10);
    }
  }

  if (convertToNB) {
    // eslint-disable-next-line no-use-before-define
    var nbPadding = paddingToNBmap[String(v)];

    if (nbPadding) {
      return nbPadding;
    }

    if (String(v).match(numberOrLengthRe)) {
      if (v === 0) {
        return v;
      }

      return v + 'px';
    }
  }

  return v;
};

var paddingToNBmap = {
  0: 0,
  2: '$0.5',
  4: '$1',
  6: '$1.5',
  8: '$2',
  10: '$2.5',
  12: '$3',
  14: '$3.5',
  16: '$4',
  20: '$5',
  24: '$6',
  28: '$7',
  32: '$8',
  36: '$9',
  40: '$10',
  48: '$12',
  56: '$13.5',
  64: '$16',
  80: '$20',
  96: '$24',
  128: '$32',
  160: '$40',
  192: '$48',
  224: '$56',
  256: '$64',
  288: '$72',
  320: '$80',
  384: '$96',
  '50%': '1/2',
  '33.333%': '1/3',
  '66.666%': '2/3',
  '25%': '1/4',
  '75%': '3/4',
  '20%': '1/5',
  '40%': '2/5',
  '60%': '3/5',
  '80%': '4/5',
  '16.666%': '1/6',
  '83.333%': '5/6',
  '100%': 'full',
};

var directionFactory = function directionFactory(_ref2) {
  var _ref2$types = _ref2.types,
    types =
      _ref2$types === void 0 ? [LENGTH, UNSUPPORTED_LENGTH_UNIT, PERCENT, SUB_VAR] : _ref2$types,
    _ref2$directions = _ref2.directions,
    directions =
      _ref2$directions === void 0 ? ['Top', 'Right', 'Bottom', 'Left'] : _ref2$directions,
    _ref2$prefix = _ref2.prefix,
    prefix = _ref2$prefix === void 0 ? '' : _ref2$prefix,
    _ref2$suffix = _ref2.suffix,
    suffix = _ref2$suffix === void 0 ? '' : _ref2$suffix,
    _ref2$allowSingle = _ref2.allowSingle,
    allowSingle = _ref2$allowSingle === void 0 ? false : _ref2$allowSingle,
    _ref2$convertToNB = _ref2.convertToNB,
    convertToNB = _ref2$convertToNB === void 0 ? false : _ref2$convertToNB;
  return function (tokenStream) {
    var _ref5;

    var values = []; // borderWidth doesn't currently allow a percent value, but may do in the future

    values.push(tokenStream.expect.apply(tokenStream, types));

    while (values.length < 4 && tokenStream.hasTokens()) {
      tokenStream.expect(SPACE);
      values.push(tokenStream.expect.apply(tokenStream, types));
    }

    tokenStream.expectEmpty();

    if (allowSingle && values.length === 1) {
      var _ref3;

      return (_ref3 = {}), (_ref3[prefix] = parseValue(values[0], convertToNB)), _ref3;
    }

    if (allowSingle && values.length === 2) {
      var _ref4;

      return (
        (_ref4 = {}),
        (_ref4[prefix + 'X'] = parseValue(values[1], convertToNB)),
        (_ref4[prefix + 'Y'] = parseValue(values[0], convertToNB)),
        _ref4
      );
    }

    var top = values[0],
      _values$ = values[1],
      right = _values$ === void 0 ? top : _values$,
      _values$2 = values[2],
      bottom = _values$2 === void 0 ? top : _values$2,
      _values$3 = values[3],
      left = _values$3 === void 0 ? right : _values$3;

    var keyFor = function keyFor(n) {
      return '' + prefix + directions[n] + suffix;
    };

    return (
      (_ref5 = {}),
      (_ref5[keyFor(0)] = parseValue(top, convertToNB)),
      (_ref5[keyFor(1)] = parseValue(right, convertToNB)),
      (_ref5[keyFor(2)] = parseValue(bottom, convertToNB)),
      (_ref5[keyFor(3)] = parseValue(left, convertToNB)),
      _ref5
    );
  };
};

var parseShadowOffset = function parseShadowOffset(tokenStream) {
  var width = tokenStream.expect(LENGTH);
  var height = tokenStream.matches(SPACE) ? tokenStream.expect(LENGTH) : width;
  tokenStream.expectEmpty();
  return {
    width: width,
    height: height,
  };
};

var parseShadow = function parseShadow(tokenStream) {
  var offsetX;
  var offsetY;
  var radius;
  var color;

  if (tokenStream.matches(NONE)) {
    tokenStream.expectEmpty();
    return {
      offset: {
        width: 0,
        height: 0,
      },
      radius: 0,
      color: 'black',
    };
  }

  var didParseFirst = false;

  while (tokenStream.hasTokens()) {
    if (didParseFirst) tokenStream.expect(SPACE);

    if (offsetX === undefined && tokenStream.matches(LENGTH, UNSUPPORTED_LENGTH_UNIT)) {
      offsetX = tokenStream.lastValue;
      tokenStream.expect(SPACE);
      offsetY = tokenStream.expect(LENGTH, UNSUPPORTED_LENGTH_UNIT);
      tokenStream.saveRewindPoint();

      if (tokenStream.matches(SPACE) && tokenStream.matches(LENGTH, UNSUPPORTED_LENGTH_UNIT)) {
        radius = tokenStream.lastValue;
      } else {
        tokenStream.rewind();
      }
    } else if (color === undefined && tokenStream.matches(COLOR)) {
      color = tokenStream.lastValue;
    } else {
      tokenStream['throw']();
    }

    didParseFirst = true;
  }

  if (offsetX === undefined) tokenStream['throw']();
  return {
    offset: {
      width: offsetX,
      height: offsetY,
    },
    radius: radius !== undefined ? radius : 0,
    color: color !== undefined ? color : 'black',
  };
};

var boxShadow = function boxShadow(tokenStream) {
  var _parseShadow = parseShadow(tokenStream),
    offset = _parseShadow.offset,
    radius = _parseShadow.radius,
    color = _parseShadow.color;

  return {
    shadowOffset: offset,
    shadowRadius: radius,
    shadowColor: color,
    shadowOpacity: 1,
  };
};

var defaultFlexGrow = 1;
var defaultFlexShrink = 1;
var defaultFlexBasis = 0;

var flex = function flex(tokenStream) {
  var flexGrow;
  var flexShrink;
  var flexBasis;

  if (tokenStream.matches(NONE)) {
    tokenStream.expectEmpty();
    return {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
    };
  }

  tokenStream.saveRewindPoint();

  if (tokenStream.matches(AUTO) && !tokenStream.hasTokens()) {
    return {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    };
  }

  tokenStream.rewind();
  var partsParsed = 0;

  while (partsParsed < 2 && tokenStream.hasTokens()) {
    if (partsParsed !== 0) tokenStream.expect(SPACE);

    if (flexGrow === undefined && tokenStream.matches(NUMBER)) {
      flexGrow = tokenStream.lastValue;
      tokenStream.saveRewindPoint();

      if (tokenStream.matches(SPACE) && tokenStream.matches(NUMBER)) {
        flexShrink = tokenStream.lastValue;
      } else {
        tokenStream.rewind();
      }
    } else if (
      flexBasis === undefined &&
      tokenStream.matches(LENGTH, UNSUPPORTED_LENGTH_UNIT, PERCENT)
    ) {
      flexBasis = tokenStream.lastValue;
    } else if (flexBasis === undefined && tokenStream.matches(AUTO)) {
      flexBasis = 'auto';
    } else {
      tokenStream['throw']();
    }

    partsParsed += 1;
  }

  tokenStream.expectEmpty();
  if (flexGrow === undefined) flexGrow = defaultFlexGrow;
  if (flexShrink === undefined) flexShrink = defaultFlexShrink;
  if (flexBasis === undefined) flexBasis = defaultFlexBasis;
  return {
    flexGrow: flexGrow,
    flexShrink: flexShrink,
    flexBasis: flexBasis,
  };
};

var FLEX_WRAP = regExpToken(/(nowrap|wrap|wrap-reverse)/);
var FLEX_DIRECTION = regExpToken(/(row|row-reverse|column|column-reverse)/);
var defaultFlexWrap = 'nowrap';
var defaultFlexDirection = 'row';

var flexFlow = function flexFlow(tokenStream) {
  var flexWrap;
  var flexDirection;
  var partsParsed = 0;

  while (partsParsed < 2 && tokenStream.hasTokens()) {
    if (partsParsed !== 0) tokenStream.expect(SPACE);

    if (flexWrap === undefined && tokenStream.matches(FLEX_WRAP)) {
      flexWrap = tokenStream.lastValue;
    } else if (flexDirection === undefined && tokenStream.matches(FLEX_DIRECTION)) {
      flexDirection = tokenStream.lastValue;
    } else {
      tokenStream['throw']();
    }

    partsParsed += 1;
  }

  tokenStream.expectEmpty();
  if (flexWrap === undefined) flexWrap = defaultFlexWrap;
  if (flexDirection === undefined) flexDirection = defaultFlexDirection;
  return {
    flexWrap: flexWrap,
    flexDirection: flexDirection,
  };
};

var fontFamily = function fontFamily(tokenStream) {
  var fontFamily;

  if (tokenStream.matches(STRING)) {
    fontFamily = tokenStream.lastValue;
  } else {
    fontFamily = tokenStream.expect(IDENT);

    while (tokenStream.hasTokens()) {
      tokenStream.expect(SPACE);
      var nextIdent = tokenStream.expect(IDENT);
      fontFamily += ' ' + nextIdent;
    }
  }

  tokenStream.expectEmpty();
  return {
    fontFamily: fontFamily,
  };
};
/* eslint-disable no-unused-vars */

var NORMAL = regExpToken(/^(normal)$/);
var STYLE = regExpToken(/^(italic)$/);
var WEIGHT = regExpToken(/^([1-9]00|bold)$/);
var VARIANT = regExpToken(/^(small-caps)$/);
var defaultFontStyle = 'normal';
var defaultFontWeight = 'normal';
var defaultFontVariant = [];

var font = function font(tokenStream) {
  var fontStyle;
  var fontWeight;
  var fontVariant; // let fontSize;

  var lineHeight; // let fontFamily;

  var numStyleWeightVariantMatched = 0;

  while (numStyleWeightVariantMatched < 3 && tokenStream.hasTokens()) {
    if (tokenStream.matches(NORMAL));
    else if (fontStyle === undefined && tokenStream.matches(STYLE)) {
      fontStyle = tokenStream.lastValue;
    } else if (fontWeight === undefined && tokenStream.matches(WEIGHT)) {
      fontWeight = tokenStream.lastValue;
    } else if (fontVariant === undefined && tokenStream.matches(VARIANT)) {
      fontVariant = [tokenStream.lastValue];
    } else {
      break;
    }
    tokenStream.expect(SPACE);
    numStyleWeightVariantMatched += 1;
  }

  var fontSize = tokenStream.expect(LENGTH, UNSUPPORTED_LENGTH_UNIT);

  if (tokenStream.matches(SLASH)) {
    lineHeight = tokenStream.expect(LENGTH, UNSUPPORTED_LENGTH_UNIT);
  }

  tokenStream.expect(SPACE);

  var _fontFamily = fontFamily(tokenStream),
    fontFamily$1 = _fontFamily.fontFamily;

  if (fontStyle === undefined) fontStyle = defaultFontStyle;
  if (fontWeight === undefined) fontWeight = defaultFontWeight;
  if (fontVariant === undefined) fontVariant = defaultFontVariant;
  var out = {
    fontStyle: fontStyle,
    fontWeight: fontWeight,
    fontVariant: fontVariant,
    fontSize: fontSize,
    fontFamily: fontFamily$1,
  };
  if (lineHeight !== undefined) out.lineHeight = lineHeight;
  return out; // return {
  //   fontStyle: defaultFontStyle,
  //   fontWeight: defaultFontWeight,
  //   fontVariant: defaultFontVariant,
  //   fontSize: '1rem',
  //   fontFamily: 'headline',
  // }
};

var ALIGN_CONTENT = regExpToken(/(flex-(?:start|end)|center|stretch|space-(?:between|around))/);
var JUSTIFY_CONTENT = regExpToken(/(flex-(?:start|end)|center|space-(?:between|around|evenly))/);

var placeContent = function placeContent(tokenStream) {
  var alignContent = tokenStream.expect(ALIGN_CONTENT);
  var justifyContent;

  if (tokenStream.hasTokens()) {
    tokenStream.expect(SPACE);
    justifyContent = tokenStream.expect(JUSTIFY_CONTENT);
  } else {
    justifyContent = 'stretch';
  }

  tokenStream.expectEmpty();
  return {
    alignContent: alignContent,
    justifyContent: justifyContent,
  };
};

var STYLE$1 = regExpToken(/^(solid|double|dotted|dashed)$/);
var defaultTextDecorationLine = 'none';
var defaultTextDecorationStyle = 'solid';
var defaultTextDecorationColor = 'black';

var textDecoration = function textDecoration(tokenStream) {
  var line;
  var style;
  var color;
  var didParseFirst = false;

  while (tokenStream.hasTokens()) {
    if (didParseFirst) tokenStream.expect(SPACE);

    if (line === undefined && tokenStream.matches(LINE)) {
      var lines = [tokenStream.lastValue.toLowerCase()];
      tokenStream.saveRewindPoint();

      if (lines[0] !== 'none' && tokenStream.matches(SPACE) && tokenStream.matches(LINE)) {
        lines.push(tokenStream.lastValue.toLowerCase()); // Underline comes before line-through

        lines.sort().reverse();
      } else {
        tokenStream.rewind();
      }

      line = lines.join(' ');
    } else if (style === undefined && tokenStream.matches(STYLE$1)) {
      style = tokenStream.lastValue;
    } else if (color === undefined && tokenStream.matches(COLOR)) {
      color = tokenStream.lastValue;
    } else {
      tokenStream['throw']();
    }

    didParseFirst = true;
  }

  return {
    textDecorationLine: line !== undefined ? line : defaultTextDecorationLine,
    textDecorationColor: color !== undefined ? color : defaultTextDecorationColor,
    textDecorationStyle: style !== undefined ? style : defaultTextDecorationStyle,
  };
};

var textDecorationLine = function textDecorationLine(tokenStream) {
  var lines = [];
  var didParseFirst = false;

  while (tokenStream.hasTokens()) {
    if (didParseFirst) tokenStream.expect(SPACE);
    lines.push(tokenStream.expect(LINE).toLowerCase());
    didParseFirst = true;
  }

  lines.sort().reverse();
  return {
    textDecorationLine: lines.join(' '),
  };
};

var textShadow = function textShadow(tokenStream) {
  var _parseShadow2 = parseShadow(tokenStream),
    offset = _parseShadow2.offset,
    radius = _parseShadow2.radius,
    color = _parseShadow2.color;

  return {
    textShadowOffset: offset,
    textShadowRadius: radius,
    textShadowColor: color,
  };
};

var oneOfType = function oneOfType(tokenType) {
  return function (functionStream) {
    var value = functionStream.expect(tokenType);
    functionStream.expectEmpty();
    return value;
  };
};

var singleNumber = oneOfType(NUMBER);
var singleLength = oneOfType(LENGTH);
var singleAngle = oneOfType(ANGLE);

var xyTransformFactory = function xyTransformFactory(tokenType) {
  return function (key, valueIfOmitted) {
    return function (functionStream) {
      var _ref6, _ref7;

      var x = functionStream.expect(tokenType);
      var y;

      if (functionStream.hasTokens()) {
        functionStream.expect(COMMA);
        y = functionStream.expect(tokenType);
      } else if (valueIfOmitted !== undefined) {
        y = valueIfOmitted;
      } else {
        // Assumption, if x === y, then we can omit XY
        // I.e. scale(5) => [{ scale: 5 }] rather than [{ scaleX: 5 }, { scaleY: 5 }]
        return x;
      }

      functionStream.expectEmpty();
      return [
        ((_ref6 = {}), (_ref6[key + 'Y'] = y), _ref6),
        ((_ref7 = {}), (_ref7[key + 'X'] = x), _ref7),
      ];
    };
  };
};

var xyNumber = xyTransformFactory(NUMBER);
var xyLength = xyTransformFactory(LENGTH);
var xyAngle = xyTransformFactory(ANGLE);
var partTransforms = {
  perspective: singleNumber,
  scale: xyNumber('scale'),
  scaleX: singleNumber,
  scaleY: singleNumber,
  translate: xyLength('translate', 0),
  translateX: singleLength,
  translateY: singleLength,
  rotate: singleAngle,
  rotateX: singleAngle,
  rotateY: singleAngle,
  rotateZ: singleAngle,
  skewX: singleAngle,
  skewY: singleAngle,
  skew: xyAngle('skew', '0deg'),
};

var transform = function transform(tokenStream) {
  var transforms = [];
  var didParseFirst = false;

  while (tokenStream.hasTokens()) {
    if (didParseFirst) tokenStream.expect(SPACE);
    var functionStream = tokenStream.expectFunction();
    var functionName = functionStream.functionName;
    var transformedValues = partTransforms[functionName](functionStream);

    if (!Array.isArray(transformedValues)) {
      var _ref8;

      transformedValues = [((_ref8 = {}), (_ref8[functionName] = transformedValues), _ref8)];
    }

    transforms = transformedValues.concat(transforms);
    didParseFirst = true;
  }

  return {
    transform: transforms,
  };
};

var background = function background(tokenStream) {
  return {
    backgroundColor: tokenStream.expect(COLOR),
  };
};

var borderColor = directionFactory({
  types: [COLOR],
  prefix: 'border',
  suffix: 'Color',
});
var borderRadius = directionFactory({
  directions: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'],
  prefix: 'border',
  suffix: 'Radius',
});
var borderWidth = directionFactory({
  prefix: 'border',
  suffix: 'Width',
});
var margin = directionFactory({
  types: [SUB_VAR, LENGTH, UNSUPPORTED_LENGTH_UNIT, PERCENT, AUTO],
  prefix: 'margin',
  convertToNB: true,
  allowSingle: true,
});
var padding = directionFactory({
  prefix: 'padding',
  convertToNB: true,
  allowSingle: true,
});

var fontVariant = function fontVariant(tokenStream) {
  return {
    fontVariant: [tokenStream.expect(IDENT)],
  };
};

var fontWeight = function fontWeight(tokenStream) {
  return {
    fontWeight: tokenStream.expect(WORD), // Also match numbers as strings
  };
};

var shadowOffset = function shadowOffset(tokenStream) {
  return {
    shadowOffset: parseShadowOffset(tokenStream),
  };
};

var textShadowOffset = function textShadowOffset(tokenStream) {
  return {
    textShadowOffset: parseShadowOffset(tokenStream),
  };
};

var transforms = {
  background: background,
  border: border(''),
  borderTop: border('Top'),
  borderBottom: border('Bottom'),
  borderLeft: border('Left'),
  borderRight: border('Right'),
  borderColor: borderColor,
  borderRadius: borderRadius,
  borderWidth: borderWidth,
  boxShadow: boxShadow,
  flex: flex,
  flexFlow: flexFlow,
  font: font,
  fontFamily: fontFamily,
  fontVariant: fontVariant,
  fontWeight: fontWeight,
  margin: margin,
  padding: padding,
  placeContent: placeContent,
  shadowOffset: shadowOffset,
  textShadow: textShadow,
  textShadowOffset: textShadowOffset,
  textDecoration: textDecoration,
  textDecorationLine: textDecorationLine,
  transform: transform,
};
var propertiesWithoutUnits;

if (process.env.NODE_ENV !== 'production') {
  propertiesWithoutUnits = [
    'aspectRatio',
    'elevation',
    'flexGrow',
    'flexShrink',
    'opacity',
    'shadowOpacity',
    'zIndex',
  ];
}

var devPropertiesWithUnitsRegExp =
  propertiesWithoutUnits != null ? new RegExp(propertiesWithoutUnits.join('|')) : null;
var SYMBOL_MATCH = 'SYMBOL_MATCH';

var TokenStream =
  /*#__PURE__*/
  (function () {
    function TokenStream(nodes, parent) {
      this.index = 0;
      this.nodes = nodes;
      this.functionName = parent != null ? parent.value : null;
      this.lastValue = null;
      this.rewindIndex = -1;
    }

    var _proto = TokenStream.prototype;

    _proto.hasTokens = function hasTokens() {
      return this.index <= this.nodes.length - 1;
    };

    _proto[SYMBOL_MATCH] = function () {
      if (!this.hasTokens()) return null;
      var node = this.nodes[this.index];

      for (var i = 0; i < arguments.length; i += 1) {
        var tokenDescriptor = i < 0 || arguments.length <= i ? undefined : arguments[i];
        var value = tokenDescriptor(node);

        if (value !== null) {
          this.index += 1;
          this.lastValue = value;
          return value;
        }
      }

      return null;
    };

    _proto.matches = function matches() {
      return this[SYMBOL_MATCH].apply(this, arguments) !== null;
    };

    _proto.expect = function expect() {
      var value = this[SYMBOL_MATCH].apply(this, arguments);
      return value !== null ? value : this['throw']();
    };

    _proto.matchesFunction = function matchesFunction() {
      var node = this.nodes[this.index];
      if (node.type !== 'function') return null;
      var value = new TokenStream(node.nodes, node);
      this.index += 1;
      this.lastValue = null;
      return value;
    };

    _proto.expectFunction = function expectFunction() {
      var value = this.matchesFunction();
      return value !== null ? value : this['throw']();
    };

    _proto.expectEmpty = function expectEmpty() {
      if (this.hasTokens()) this['throw']();
    };

    _proto['throw'] = function _throw() {
      throw new Error('Unexpected token type: ' + this.nodes[this.index].type);
    };

    _proto.saveRewindPoint = function saveRewindPoint() {
      this.rewindIndex = this.index;
    };

    _proto.rewind = function rewind() {
      if (this.rewindIndex === -1) throw new Error('Internal error');
      this.index = this.rewindIndex;
      this.lastValue = null;
    };

    return TokenStream;
  })();
/* eslint-disable no-console */
// Note if this is wrong, you'll need to change tokenTypes.js too

var numberOrLengthRe$1 = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)(?:px|rem)?$/i;
var numberOnlyRe = /^[+-]?(?:\d*\.\d*|[1-9]\d*)(?:e[+-]?\d+)?$/i;
var boolRe = /^true|false$/i;
var nullRe = /^null$/i;
var undefinedRe = /^undefined$/i;
var PropsToConvertToNB = ['margin', 'padding', 'height', 'width']; // Undocumented export

var transformRawValue = function transformRawValue(propName, value) {
  var needsUnit = !devPropertiesWithUnitsRegExp.test(propName);
  var isNumberWithoutUnit = numberOnlyRe.test(value);

  if (!needsUnit && value !== '0' && !isNumberWithoutUnit) {
    // these are TEMP variable substitutions in the caller
    if (!value.includes('substitution__'));
  }

  if (typeof value === 'number') {
    value = String(value);
  }

  var numberMatch = value.match(numberOrLengthRe$1);
  var convertToNB = PropsToConvertToNB.some(function (v) {
    return propName.includes(v);
  });
  if (numberMatch !== null) return parseValue(numberMatch[0], convertToNB);
  var boolMatch = value.match(boolRe);
  if (boolMatch !== null) return boolMatch[0].toLowerCase() === 'true';
  var nullMatch = value.match(nullRe);
  if (nullMatch !== null) return null;
  var undefinedMatch = value.match(undefinedRe);
  if (undefinedMatch !== null) return undefined;
  return value;
};

var baseTransformShorthandValue = function baseTransformShorthandValue(propName, value) {
  var ast = parse__default(String(value));
  var tokenStream = new TokenStream(ast.nodes);
  var fn = transforms[propName];
  var res = fn(tokenStream);
  return res;
};

var transformShorthandValue = function transformShorthandValue(propName, value) {
  try {
    return baseTransformShorthandValue(propName, value);
  } catch (e) {
    throw new Error('Failed to parse declaration "' + propName + ': ' + value + '"');
  }
};

var getStylesForProperty = function getStylesForProperty(propName, inputValue, allowShorthand) {
  var _ref9;

  var isRawValue = allowShorthand === false || !(propName in transforms);
  var value = inputValue;

  try {
    if (typeof inputValue === 'string') {
      value = inputValue.trim();
    }
  } catch (err) {
    throw new Error('inputValue: ' + propName + ': ' + inputValue);
  }

  var propValues = isRawValue
    ? ((_ref9 = {}), (_ref9[propName] = transformRawValue(propName, value)), _ref9)
    : transformShorthandValue(propName, value);
  return propValues;
};

var getPropertyName = function getPropertyName(propName) {
  var isCustomProp = /^--\w+/.test(propName);

  if (isCustomProp) {
    return propName;
  }

  return camelizeStyleName(propName);
};

var index = function index(rules, shorthandBlacklist) {
  if (shorthandBlacklist === void 0) {
    shorthandBlacklist = [];
  }

  return rules.reduce(function (accum, rule) {
    var propertyName = getPropertyName(rule[0]);
    var value = rule[1];
    var allowShorthand = shorthandBlacklist.indexOf(propertyName) === -1;
    return Object.assign(accum, getStylesForProperty(propertyName, value, allowShorthand));
  }, {});
};

exports['default'] = index;
exports.getPropertyName = getPropertyName;
exports.getStylesForProperty = getStylesForProperty;
exports.transformRawValue = transformRawValue;
