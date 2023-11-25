import { Result } from "ts-results";
import ts, { Statement } from "typescript";
import { State } from "./classes/state";

export function print_ast(
	node: ts.Node | undefined | ts.Node[],
	log = true,
	label = "",
) {
	if (node) {
		if (Array.isArray(node)) {
			for (const n of node) {
				print_ast(n, log);
			}
			return;
		}
		const printed = ts
			.createPrinter({ removeComments: true })
			.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
		if (log) console.log(printed, label);

		return printed;
	} else {
		return node;
	}
}
export function assert(value: unknown, message?: string): asserts value {
	if (!value) {
		debugger;
		throw new Error(`Assertion Failed! ${message ?? ""}`);
	}
}

export function quote(
	templateStrings: TemplateStringsArray,
	...values: unknown[]
): ts.Statement {
	let result = "";
	function append(value: unknown) {
		if (value === undefined) {
			return;
		}
		if (typeof value === "number") {
			result += value;
			return;
		}
		if (typeof value === "string") {
			result += value;
			return;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				append(item);
			}
			return;
		}
		if (value && value instanceof Object) {
			if ("kind" in value) {
				const node = value as ts.Node;
				if (ts.isIdentifier(node)) {
					result += node.text;
					return;
				}

				if (ts.isStringLiteral(node)) {
					result += `"${node.text}"`;
					return;
				}
				if (ts.isToken(node)) {
					const src = node as ts.Node;
					result += print_ast(node, false);
					return;
				}
				result += print_ast(node, false);
				return;
			}
		}
		console.log(value);
		throw new Error(`unsupported value type `);
	}
	for (let i = 0; i < templateStrings.length; i++) {
		result += templateStrings[i];
		if (i < values.length) {
			const value = values[i];
			append(value);
		}
	}
	// Create a source file to hold the stream content
	const sourceFile = ts.createSourceFile(
		"temp.ts",
		result,
		ts.ScriptTarget.ES2016,
		undefined,
		ts.ScriptKind.TSX,
	);

	// Get the first statement from the source file
	const statement = sourceFile.statements[0];
	// Return the statement
	return statement;
}
export function quoteExpr(
	templateStrings: TemplateStringsArray,
	...values: any[]
) {
	const stmt = quote(templateStrings, ...values);
	if (!ts.isExpressionStatement(stmt)) {
		throw new Error("expected expression statement");
	}
	return stmt.expression;
}
// example usage: quote`let x = 1;` = ts.VariableStatement
// example usage: quote`if (x == 1) {}` = ts.IfStatement
declare global {
	type TResult<T> = Result<T, ts.DiagnosticWithLocation[]>;
}

export function get_$render_call(
	statements: Iterable<Statement>,
	state: State,
) {
	const render_calls = new Array<readonly [ts.Symbol, ts.CallExpression]>();
	for (const statement of statements) {
		if (!ts.isExpressionStatement(statement)) continue;
		if (!ts.isCallExpression(statement.expression)) continue;
		const call_expression = statement.expression;
		const expresison_symbol = is_$render_call(call_expression, state);
		if (!expresison_symbol) continue;

		if (state.is_verbose) console.log("found render call");
		render_calls.push([expresison_symbol, call_expression] as const);
	}
	return render_calls;
}
export function is_$render_call(
	call_expression: ts.CallExpression,
	state: State,
) {
	const expression = call_expression.expression;

	const expresison_symbol =
		state.type_checker.getSymbolAtLocation(expression);

	if (!expresison_symbol) return false;

	if (expresison_symbol.name !== "$render") return false;
	return expresison_symbol;
}
export function is_$render_statement(statement: Statement, state: State) {
	if (!ts.isExpressionStatement(statement)) return false;
	if (!ts.isCallExpression(statement.expression)) return false;
	const call_expression = statement.expression;
	const expresison_symbol = is_$render_call(call_expression, state);
	if (!expresison_symbol) return false;
	return true;
}
const eqSet = <T>(xs: Set<T>, ys: Set<T>) =>
	xs.size === ys.size && [...xs].every((x) => ys.has(x));
