import ts, { Expression, SyntaxKind, factory } from "typescript";
import { State } from "../classes/state";
import { Ok } from "ts-results";
import { print_ast, quoteExpr } from "../util";
import { transform_expression } from "./transform_expression";

export function transform_binary_expression(
	node: ts.BinaryExpression,
	state: State,
): TResult<ts.Expression> {
	if (!ts.isAssignmentOperator(node.operatorToken.kind))
		return Ok(state.transform(node));
	const left = node.left;
	const is_lhs = ts.isLeftHandSideOfAssignment(left);
	if (is_lhs) {
		const symbol = state.type_checker.getSymbolAtLocation(left);
		if (!symbol) return Ok(node);
		const is_stateful = state.stateful_symbols.has(symbol);
		const is_compound = ts.isCompoundAssignment(node.operatorToken.kind);

		let new_value!: Expression;
		if (is_stateful) {
			if (is_compound) {
				new_value = factory.createBinaryExpression(
					transform_expression(left, state).unwrap(),
					ts.getNonAssignmentOperatorForCompoundAssignment(
						node.operatorToken.kind,
					),
					state.transform(node.right),
				);
			} else {
				new_value = state.transform(node.right);
			}

			const expr = quoteExpr`ezui.set(${print_ast(
				left,
				false,
			)}, ${print_ast(new_value, false)}`;
			return Ok(expr);
		}
	}
	const result = state.transform<Expression>(node);
	return Ok(result);
}
