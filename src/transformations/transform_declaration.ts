import ts, { ClassDeclaration, factory } from "typescript";
import { State } from "../classes/state";
import { Ok } from "ts-results";
import { print_ast } from "../util";
import { transform_expression } from "./transform_expression";

export function transform_property_declaration(
	node: ts.PropertyDeclaration,
	state: State,
): TResult<ts.PropertyDeclaration> {
	for (;;) {
		let initializer = node.initializer!;
		if (!initializer) break;
		let info;
		[initializer, info] = state.capture_info(() =>
			transform_expression(initializer, state).unwrap(),
		);
		if (info?.is_$state_macro) {
			const name = node.name;
			if (!ts.isIdentifier(name)) throw new Error("expected identifier");
			state.stateful_symbols.set(node.symbol, name);
		}

		return Ok(
			factory.updatePropertyDeclaration(
				node,
				node.modifiers,
				node.name,
				node.questionToken,
				node.type,
				initializer,
			),
		);
	}
	return Ok(state.transform(node));
}
