import ts, { SyntaxKind } from "typescript";
import { State } from "../classes/state";
import { Ok } from "ts-results";
import { quoteExpr } from "../util";
import { transform_expression } from "./transform_expression";

export function transform_postfixed_unary_expression(
	node: ts.PostfixUnaryExpression,
	state: State,
): TResult<ts.Expression> {
	for (;;) {
		const symbol = state.type_checker.getSymbolAtLocation(node.operand);
		if (!symbol) break;
		const is_stateful = state.symbol_is_stateful(symbol);
		if (!is_stateful) break;
		return Ok(quoteExpr`(() => {
            let tmp = ${transform_expression(node.operand, state).unwrap()}
            const tmp_2 = ${
				node.operator === SyntaxKind.PlusPlusToken ? "tmp++" : "tmp--"
			}
            ezui.set(${node.operand}, tmp);
            return tmp_2;
        })()`);
	}
	return Ok(state.transform(node));
}
