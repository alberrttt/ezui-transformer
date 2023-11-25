import ts, { SyntaxKind } from "typescript";
import { State } from "../classes/state";
import { Ok } from "ts-results";
import { quoteExpr } from "../util";
import { transform_expression } from "./transform_expression";

export function transform_postfixed_unary_expression(
	node: ts.PostfixUnaryExpression,
	state: State,
): TResult<ts.Expression> {
	return Ok(quoteExpr`(() => {
        let tmp = ${transform_expression(node.operand, state).unwrap()}
        const tmp_2 = ${
			node.operator === SyntaxKind.PlusPlusToken ? "tmp++" : "tmp--"
		}
        ezui.set(${node.operand}, tmp);
        return tmp_2;
    })()`);
}
