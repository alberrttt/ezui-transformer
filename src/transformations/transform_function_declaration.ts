import ts from "typescript";
import { State } from "../classes/state";
import { Ok } from "ts-results";

export function transform_transform_declaration(
	node: ts.FunctionDeclaration,
	state: State,
): TResult<ts.FunctionDeclaration> {
	const result = state.transform(node);


	if (!ts.isFunctionDeclaration(result))
		throw new Error("Node was not a function declaration");

	return Ok(result);
}
