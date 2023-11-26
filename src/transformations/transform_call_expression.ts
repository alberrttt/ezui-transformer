import ts, { SymbolFlags, factory } from "typescript";
import { State } from "../classes/state";
import { Ok } from "ts-results";
import { print_ast, quoteExpr } from "../util";
import { transform_expression } from "./transform_expression";

export function transform_call_expression(
	node: ts.CallExpression,
	state: State,
): TResult<ts.Expression> {
	const name = node.expression;
	const name_symbol = state.type_checker.getSymbolAtLocation(name);
	if (!name_symbol) return Ok(state.transform(node));
	if (state.symbol_is_macro(name_symbol, "$effect")) {
		const argument = node.arguments[0];

		return Ok(quoteExpr`ezui.user_effect(${state.transform(argument)})`);
	}
	if (state.symbol_is_macro(name_symbol, "$fnc")) {
		const argument = node.arguments[0];
		if (!ts.isIdentifier(argument)) throw new Error("expected identifier");

		return Ok(
			quoteExpr`(p:__${argument.text}__props,c:Instance) => ${argument}(p,c)`,
		);
	}
	if (state.symbol_is_macro(name_symbol, "$mount")) {
		const argument = node.arguments[0];
		let target = node.arguments[1];
		if (!target) {
			target = factory.createCallExpression(
				factory.createIdentifier("playerGui"),
				[],
				[],
			);
		}
		return Ok(quoteExpr`${argument}({},${target})`);
	}
	if (state.symbol_is_macro(name_symbol, "$state")) {
		state.info.is_$state_macro = true;
		const argument = node.arguments[0];

		const arg_type = state.type_checker.getTypeAtLocation(node);

		const type_node = state.type_checker.typeToTypeNode(
			arg_type,
			node,
			undefined,
			undefined,
		);

		return Ok(quoteExpr`ezui.source(${argument})`);
	}
	if (state.symbol_is_macro(name_symbol, "$derived")) {
		state.info.is_$derived_macro = true;
		const argument = node.arguments[0];
		return transform_expression(argument, state);
	}

	return Ok(state.transform(node));
}
