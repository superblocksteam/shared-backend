import Mustache from 'mustache';

// All variables are HTML-escaped by default in Mustache,
// override escape to disable it https://github.com/janl/mustache.js/#variables
Mustache.escape = function (text) {
  return text;
};

export class FlatContext extends Mustache.Context {
  cache: Record<string, unknown>;

  constructor(view: Record<string, unknown>, parentContext?: FlatContext & { view }) {
    super(view, parentContext);

    this.cache = parentContext ? parentContext.view : view;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const renderFieldValues = (object: any, context: any): void => {
  const flatContext = new FlatContext(context);

  Object.keys(object).forEach((key) => {
    const value = object[key];

    if (value instanceof Object) {
      renderFieldValues(value, context);
    }

    if (typeof value === 'string') {
      object[key] = Mustache.render(value, flatContext);
    }
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const renderValue = (val: string, context: any): string => {
  const flatContext = new FlatContext(context);
  return Mustache.render(val, flatContext);
};

export const extractMustacheStrings = (input: string): Array<string> => {
  // 'name' refers to the value extracted out of mustache curly braces {{ }}
  return Mustache.parse(input)
    .filter((item) => item[0] === 'name')
    .map((item) => item[1]);
};
