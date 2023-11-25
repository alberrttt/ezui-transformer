import ts, {
	ModuleDeclaration,
	NamespaceDeclaration,
	factory,
} from "typescript";
import { State } from "../classes/state";
import { transform_component } from "./transform_component";
import { get_$render_call, print_ast } from "../util";
import { Ok } from "ts-results";

export function transform_module_declaration(
	node: ModuleDeclaration,
	state: State,
): TResult<ts.Node> {
	if (!node.body) return Ok(node);
	if (!ts.isModuleBlock(node.body)) return Ok(node);

	const render_calls = get_$render_call(node.body.statements, state);

	return Ok(
		render_calls.length === 0
			? node
			: transform_component(node, state, render_calls),
	);
}
