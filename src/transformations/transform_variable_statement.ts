import ts, { factory } from "typescript";
import { State } from "../classes/state";
import { transform_expression } from "./transform_expression";
import { assert, print_ast, quoteExpr } from "../util";
import {
	DiagnosticMessageIds,
	GetDiagnosticForNode,
	GetDiagnosticForNodes,
} from "../diagnostics";

export function transform_variable_statement(
	node: ts.VariableStatement,
	state: State,
): ts.VariableStatement {
	const declarations = new Array<ts.VariableDeclaration>();
	declarations: for (const declaration of node.declarationList.declarations) {
		for (;;) {
			const is_export = ts.hasSyntacticModifier(
				node,
				ts.ModifierFlags.Export,
			);
			const is_component = !!state.current_component;
			const init = declaration.initializer;

			const declaration_symbol = state.type_checker.getSymbolAtLocation(
				declaration.name,
			);
			if (!declaration_symbol) break;
			let [initializer, info] = init
				? state.capture_info(() =>
						transform_expression(init, state).unwrap(),
				  )
				: [undefined, undefined];
			if (info) {
				if (
					is_component &&
					is_export &&
					(info.is_$derived_macro || info.is_$state_macro)
				) {
					// runes are disallowed in exported variables (also considered props)
					state.ctx.addDiagnostic(
						GetDiagnosticForNode(
							node,

							DiagnosticMessageIds.RunesAreNotAllowed,
						),
					);
					continue declarations;
				}
				if (info.is_$state_macro) {
					assert(ts.isIdentifier(declaration.name));
					state.stateful_symbols.set(
						declaration_symbol,
						declaration.name,
					);
				}
			}
			let exclaimationToken = declaration.exclamationToken;
			if (is_component) {
				if (ts.isIdentifier(declaration.name)) {
					state.current_component!.allocate_variable(
						declaration.name,
					);
				}
				if (is_export) {
					initializer = initializer
						? quoteExpr`__props__["${declaration.name}"] ? __props__["${declaration.name}"] : ${initializer}`
						: quoteExpr`__props__["${declaration.name}"] ? __props__["${declaration.name}"] : undefined	`;
					initializer = factory.createAsExpression(
						initializer,
						factory.createTypeReferenceNode("any"),
					);
					exclaimationToken = undefined;
				}
			}
			declarations.push(
				factory.updateVariableDeclaration(
					declaration,
					declaration.name,
					exclaimationToken,
					declaration.type,
					initializer,
				),
			);
			continue declarations;
		}
		declarations.push(declaration);
	}
	return factory.updateVariableStatement(
		node,
		state.current_component
			? (node.modifiers || []).filter(
					(modifier) => modifier.kind !== ts.SyntaxKind.ExportKeyword,
			  )
			: node.modifiers,
		factory.createVariableDeclarationList(
			declarations,
			node.declarationList.flags,
		),
	);
}
