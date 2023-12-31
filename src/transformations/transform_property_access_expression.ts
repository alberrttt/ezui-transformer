import ts, { Expression, PropertyAccessExpression } from "typescript";
import { State } from "../classes/state";
import { Ok } from "ts-results";
import { print_ast, quoteExpr } from "../util";

export function transform_property_access_expression(
	node: ts.PropertyAccessExpression,
	state: State,
): TResult<Expression> {
	for (;;) {
		const symbol = state.type_checker.getSymbolAtLocation(node);
		if (!symbol) break;
		const is_stateful = state.symbol_is_stateful(symbol);
		if (is_stateful || !state.symbol_is_defined_by_component(symbol)) {
			state.stateful_dependencies.push(symbol);
		}
		if (!is_stateful) break;
		state.info.is_$state_macro = true;
		return Ok(quoteExpr`ezui.get(${node}))`);
	}

	return Ok(state.transform(node));
}
