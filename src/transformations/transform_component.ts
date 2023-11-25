import ts, { factory } from "typescript";
import { State } from "../classes/state";
import { assert, print_ast } from "../util";
import { Component } from "../classes/component";

export function transform_component(
	module_declaration: ts.ModuleDeclaration,
	state: State,
	render_calls: (readonly [ts.Symbol, ts.CallExpression])[],
): ts.Node {
	assert(module_declaration.body);
	assert(ts.isModuleBlock(module_declaration.body), "expected module block");
	const name = module_declaration.name;
	const name_symbol = state.type_checker.getSymbolAtLocation(name);
	if (!name_symbol) throw new Error("expected name symbol");
	const component = new Component(
		module_declaration as never,
		state,
		render_calls,
	);
	return component.build();
}
