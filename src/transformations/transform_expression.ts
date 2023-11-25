import ts, { Expression, SyntaxKind } from "typescript";
import { State } from "../classes/state";
import { transform_call_expression } from "./transform_call_expression";
import { Ok, Result } from "ts-results";
import { transform_identifier } from "./transform_identifier";
import { print_ast } from "../util";
import { transform_binary_expression } from "./transform_binary_expression";
import { transform_jsx_element_like } from "./transform_jsx";
import { transform_postfixed_unary_expression as transform_postfix_unary_expression } from "./transform_unary_expression";
import { transform_property_access_expression } from "./transform_property_access_expression";
const transform_table = new Map<
	SyntaxKind,
	(node: any, state: State) => TResult<ts.Expression>
>([
	[SyntaxKind.CallExpression, transform_call_expression],
	[SyntaxKind.Identifier, transform_identifier],
	[SyntaxKind.BinaryExpression, transform_binary_expression],
	[SyntaxKind.Identifier, transform_identifier],
	[SyntaxKind.JsxElement, transform_jsx_element_like],
	[SyntaxKind.JsxSelfClosingElement, transform_jsx_element_like],
	[SyntaxKind.JsxFragment, transform_jsx_element_like],
	[
		SyntaxKind.ParenthesizedExpression,
		(node: ts.ParenthesizedExpression, state: State) => {
			return transform_expression(node.expression, state);
		},
	],
	[SyntaxKind.PostfixUnaryExpression, transform_postfix_unary_expression],
	[SyntaxKind.PropertyAccessExpression, transform_property_access_expression],
]);
export function transform_expression(
	node: ts.Expression,
	state: State,
): TResult<ts.Expression> {
	const transformer = transform_table.get(node.kind);

	if (transformer) {
		return transformer(node as never, state);
	}

	return Ok(state.transform(node));
}
