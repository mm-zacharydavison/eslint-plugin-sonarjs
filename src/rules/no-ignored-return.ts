/*
 * eslint-plugin-sonarjs
 * Copyright (C) 2018-2021 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
// https://sonarsource.github.io/rspec/#/rspec/S2201

import * as typescript from 'typescript';
import type { ParserServices, TSESTree } from '@typescript-eslint/experimental-utils';
import { isRequiredParserServices, RequiredParserServices } from '../utils/parser-services';
import { Rule } from '../utils/types';
import docsUrl from '../utils/docs-url';
import { getTypeFromTreeNode } from '../utils';

type MethodMap = { [index: string]: Set<string> };

const METHODS_WITHOUT_SIDE_EFFECTS: MethodMap = {
  array: new Set([
    'concat',
    'includes',
    'join',
    'slice',
    'indexOf',
    'lastIndexOf',
    'entries',
    'filter',
    'findIndex',
    'keys',
    'map',
    'values',
    'find',
    'reduce',
    'reduceRight',
    'toString',
    'toLocaleString',
  ]),
  date: new Set([
    'getDate',
    'getDay',
    'getFullYear',
    'getHours',
    'getMilliseconds',
    'getMinutes',
    'getMonth',
    'getSeconds',
    'getTime',
    'getTimezoneOffset',
    'getUTCDate',
    'getUTCDay',
    'getUTCFullYear',
    'getUTCHours',
    'getUTCMilliseconds',
    'getUTCMinutes',
    'getUTCMonth',
    'getUTCSeconds',
    'getYear',
    'toDateString',
    'toISOString',
    'toJSON',
    'toGMTString',
    'toLocaleDateString',
    'toLocaleTimeString',
    'toTimeString',
    'toUTCString',
    'toString',
    'toLocaleString',
  ]),
  math: new Set([
    'abs',
    'E',
    'LN2',
    'LN10',
    'LOG2E',
    'LOG10E',
    'PI',
    'SQRT1_2',
    'SQRT2',
    'abs',
    'acos',
    'acosh',
    'asin',
    'asinh',
    'atan',
    'atanh',
    'atan2',
    'cbrt',
    'ceil',
    'clz32',
    'cos',
    'cosh',
    'exp',
    'expm1',
    'floor',
    'fround',
    'hypot',
    'imul',
    'log',
    'log1p',
    'log10',
    'log2',
    'max',
    'min',
    'pow',
    'random',
    'round',
    'sign',
    'sin',
    'sinh',
    'sqrt',
    'tan',
    'tanh',
    'trunc',
  ]),
  number: new Set(['toExponential', 'toFixed', 'toPrecision', 'toLocaleString', 'toString']),
  regexp: new Set(['test', 'toString']),
  string: new Set([
    'charAt',
    'charCodeAt',
    'codePointAt',
    'concat',
    'includes',
    'endsWith',
    'indexOf',
    'lastIndexOf',
    'localeCompare',
    'match',
    'normalize',
    'padEnd',
    'padStart',
    'repeat',
    'replace',
    'search',
    'slice',
    'split',
    'startsWith',
    'substr',
    'substring',
    'toLocaleLowerCase',
    'toLocaleUpperCase',
    'toLowerCase',
    'toUpperCase',
    'trim',
    'length',
    'toString',
    'valueOf',

    // HTML wrapper methods
    'anchor',
    'big',
    'blink',
    'bold',
    'fixed',
    'fontcolor',
    'fontsize',
    'italics',
    'link',
    'small',
    'strike',
    'sub',
    'sup',
  ]),
};

namespace Options {
  export interface CustomBlacklist {
    custom: {
      methods: { [index: string]: string[] };
      functions: string[];
    };
  }
}

interface CustomBlacklist {
  custom: {
    methods: MethodMap;
    functions: string[];
  };
}

function functionCallExpression(
  context: Rule.RuleContext,
  node: TSESTree.Node,
  services: ParserServices,
  blacklist: CustomBlacklist,
) {
  const { parent } = node;
  const call = node as TSESTree.CallExpression;
  const { callee } = call;

  if (callee.type !== 'Identifier') {
    return;
  }
  if (parent && parent.type !== 'ExpressionStatement') {
    return;
  }

  const functionName = callee.name;
  if (isCustomFunction(functionName, blacklist)) {
    const signature = services.program
      .getTypeChecker()
      .getResolvedSignature(
        services.esTreeNodeToTSNodeMap.get(node) as typescript.CallLikeExpression,
      );
    if (!signature) {
      return;
    }
    const returnType = services.program.getTypeChecker().getReturnTypeOfSignature(signature) as any;
    if (returnType.intrinsicName === 'error') {
      return;
    }
    context.report({
      message: message(functionName),
      node,
    });
  }
}

function methodCallExpression(
  context: Rule.RuleContext,
  node: TSESTree.Node,
  services: ParserServices,
  blacklist: CustomBlacklist,
) {
  const { parent } = node;
  const call = node as TSESTree.CallExpression;
  const { callee } = call;

  if (callee.type !== 'MemberExpression') {
    return;
  }
  if (parent && parent.type !== 'ExpressionStatement') {
    return;
  }

  const methodName = context.getSourceCode().getText(callee.property);
  const objectType = services.program
    .getTypeChecker()
    .getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(callee.object as TSESTree.Node));
  if (
    isBlacklistedMethod(methodName, objectType, services, blacklist) &&
    !isReplaceWithCallback(methodName, call.arguments, services)
  ) {
    context.report({
      message: message(methodName),
      node,
    });
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Return values from functions without side effects should not be ignored',
      category: 'Possible Errors',
      recommended: 'error',
      url: docsUrl(__filename),
    },
    schema: [
      {
        type: 'object',
        properties: {
          custom: {
            type: 'object',
            properties: {
              methods: {
                type: 'object',
                additionalProperties: {
                  type: 'array',
                  items: { type: 'string' },
                },
                default: {},
              },
              functions: {
                type: 'array',
                items: { type: 'string' },
                default: [],
              },
            },
          },
        },
      },
    ],
  },
  create(context: Rule.RuleContext) {
    if (!isRequiredParserServices(context.parserServices)) {
      return {};
    }
    const customBlacklist = loadCustomBlacklist(context);
    const services = context.parserServices;
    return {
      CallExpression: (node: TSESTree.Node) => {
        const call = node as TSESTree.CallExpression;
        const { callee } = call;

        switch (callee.type) {
          case 'Identifier':
            functionCallExpression(context, node, services, customBlacklist);
            break;
          case 'MemberExpression':
            methodCallExpression(context, node, services, customBlacklist);
            break;
          default:
        }
      },
    };
  },
};

function isReplaceWithCallback(
  methodName: string,
  callArguments: Array<TSESTree.Expression | TSESTree.SpreadElement>,
  services: RequiredParserServices,
) {
  if (methodName === 'replace' && callArguments.length > 1) {
    const type = getTypeFromTreeNode(callArguments[1], services);
    const typeNode = services.program.getTypeChecker().typeToTypeNode(type, undefined, undefined);
    // dynamically import 'typescript' as classic 'import' will fail if project not using 'typescript' parser
    // we are sure it's available as 'RequiredParserServices' are available here
    const ts = require('typescript');
    return typeNode && ts.isFunctionTypeNode(typeNode);
  }
  return false;
}

function message(methodName: string): string {
  if (methodName === 'map') {
    return `Consider using "forEach" instead of "map" as its return value is not being used here.`;
  } else {
    return `The return value of "${methodName}" must be used.`;
  }
}

function loadCustomBlacklist(context: Rule.RuleContext): CustomBlacklist {
  const customBlacklistOption = context.options.find(
    option => (option as Options.CustomBlacklist).custom,
  ) as Options.CustomBlacklist;
  const option = customBlacklistOption || { custom: { methods: {}, functions: [] } };
  return {
    custom: {
      methods: Object.entries(option.custom.methods).reduce(
        (p, [k, v]) => ({ ...p, [k]: new Set(v) }),
        {},
      ),
      functions: option.custom.functions,
    },
  };
}

function isBlacklistedMethod(
  methodName: string,
  objectType: any,
  services: RequiredParserServices,
  customBlacklist: CustomBlacklist,
): boolean {
  return (
    isDefaultBlacklisted(methodName, objectType, services) ||
    isCustomMethod(methodName, objectType, services, customBlacklist)
  );
}

function isDefaultBlacklisted(
  methodName: string,
  objectType: any,
  services: RequiredParserServices,
) {
  return methodExistsInMethodMap(methodName, objectType, services, METHODS_WITHOUT_SIDE_EFFECTS);
}

function isCustomMethod(
  methodName: string,
  objectType: any,
  services: RequiredParserServices,
  customBlacklist: CustomBlacklist,
): boolean {
  return methodExistsInMethodMap(methodName, objectType, services, customBlacklist.custom.methods);
}

function isCustomFunction(functionName: string, customBlacklist: CustomBlacklist): boolean {
  return customBlacklist.custom.functions.includes(functionName);
}

function methodExistsInMethodMap(
  methodName: string,
  objectType: any,
  services: RequiredParserServices,
  methodMap: MethodMap,
): boolean {
  const typeAsString = typeToString(objectType, services);
  if (typeAsString !== null) {
    const methods = methodMap[typeAsString];
    return methods !== undefined && methods.has(methodName);
  }
  return false;
}

function typeToString(tp: any, services: RequiredParserServices): string | null {
  const typechecker = services.program.getTypeChecker();

  const baseType = typechecker.getBaseTypeOfLiteralType(tp);
  const typeAsString = typechecker.typeToString(baseType);
  if (typeAsString === 'number' || typeAsString === 'string') {
    return typeAsString;
  }

  const symbol = tp.getSymbol();
  if (symbol) {
    const name = symbol.getName();
    switch (name) {
      case 'Array':
      case 'Date':
      case 'Math':
      case 'RegExp':
        return name.toLowerCase();
    }
  }

  return typeAsString;
}

export = rule;
