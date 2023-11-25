import ts, { Expression } from "typescript";
import { State } from "../classes/state";
import { print_ast, quoteExpr } from "../util";
import { Ok } from "ts-results";

export function transform_identifier(
	node: ts.Identifier,
	state: State,
): TResult<Expression> {
	const symbol = state.type_checker.getSymbolAtLocation(node);
	if (!symbol) return Ok(node);
	const is_stateful = state.stateful_symbols.has(symbol);
	if (is_stateful) {
		state.stateful_dependencies.push(symbol);
		return Ok(quoteExpr`ezui.get(${node})`);
	}
	return Ok(state.transform(node));
}
