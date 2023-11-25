import ts, { DiagnosticWithLocation, factory } from "typescript";
import { State } from "./classes/state";
import { transform_node } from "./transformations/transform_node";
import { print_ast } from "./util";
import { Err, Ok } from "ts-results";

export function transform_source_file(
	source_file: ts.SourceFile,
	state: State,
): TResult<ts.SourceFile> {
	const errors = new Array<DiagnosticWithLocation>();
	const result = ts.visitEachChild(
		source_file,
		(node) => {
			const [result, prereqs] = state.capture_prereqs(() =>
				transform_node(node, state),
			);
			if (result.err) {
				errors.push(...result.val);
				return node;
			}
			return factory.createNodeArray([...prereqs, result.val]);
		},
		state.ctx,
	);

	if (errors.length > 0) {
		return Err(errors);
	}
	return Ok(result);
}
