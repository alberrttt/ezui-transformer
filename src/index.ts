import ts from "typescript";
import { State } from "./classes/state";
import { transform_source_file } from "./transform_source_file";
import {} from "ts-expose-internals";
declare global {
	interface TransformerConfig {}
}

export = (program: ts.Program, config: TransformerConfig) => {
	const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
		const is_verbose = process.argv.includes("--verbose");
		const state = new State(program, config, context, is_verbose);
		if (is_verbose) {
			console.log("\nrunning ezui-transformer in verbose");
		}

		return (file) => {
			if (!state.has_collected_info) {
				state.collect_info();
			}
			const originalFile = ts.getParseTreeNode(file, ts.isSourceFile);
			if (originalFile) {
				const preEmitDiagnostics = ts.getPreEmitDiagnostics(
					program,
					originalFile,
				);
				if (
					preEmitDiagnostics.some(
						(x) => x.category === ts.DiagnosticCategory.Error,
					)
				) {
					preEmitDiagnostics
						.filter(ts.isDiagnosticWithLocation)
						.forEach((diag) => context.addDiagnostic(diag));
					return file;
				}
			}
			const result = transform_source_file(file, state);
			if (result.ok) {
				return result.val;
			} else {
				for (const error of result.val) {
					context.addDiagnostic(error);
				}
				return file;
			}
		};
	};
	return transformer;
};
