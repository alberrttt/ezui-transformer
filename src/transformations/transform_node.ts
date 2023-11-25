import ts, { SyntaxKind, factory } from "typescript";
import { State } from "../classes/state";
import { transform_module_declaration } from "./transform_module";
import { print_ast } from "../util";
import { transform_expression } from "./transform_expression";
import { Ok } from "ts-results";
import { transform_statement } from "./transform_statement";
import { transform_property_declaration } from "./transform_declaration";

export function transform_node(node: ts.Node, state: State): TResult<ts.Node> {
	if (ts.isModuleDeclaration(node)) {
		return transform_module_declaration(node, state);
	}
	if (ts.isExpression(node)) {
		return transform_expression(node, state);
	}

	if (ts.isStatement(node)) {
		return transform_statement(node, state);
	}

	if (ts.isPropertyDeclaration(node)) {
		return transform_property_declaration(node, state);
	}

	return Ok(state.transform(node));
}
