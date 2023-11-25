import ts, { Statement } from "typescript";
import { State } from "../classes/state";
import { Ok } from "ts-results";
import { transform_variable_statement } from "./transform_variable_statement";

export function transform_statement(
	node: ts.Statement,
	state: State,
): TResult<Statement> {
	if (ts.isVariableStatement(node)) {
		return Ok(transform_variable_statement(node, state));
	}
	return Ok(state.transform(node));
}
