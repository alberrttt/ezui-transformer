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
		const is_component = !!state.current_component;
		const init = declaration.initializer;

		const declaration_symbol = state.type_checker.getSymbolAtLocation(
			declaration.name,
		);
		for (;;) {
			let type = declaration.type;

			const is_export = ts.hasSyntacticModifier(
				node,
				ts.ModifierFlags.Export,
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
				state.current_component!.symbols_defined_by_component.add(
					declaration_symbol,
				);
				if (ts.isIdentifier(declaration.name)) {
					state.current_component!.allocate_variable(
						declaration.name,
					);
				}
				if (is_export) {
					initializer = initializer
						? quoteExpr`ezui.prop_source(__props__,"${declaration.name}",${initializer})`
						: quoteExpr`ezui.prop_source(__props__,"${declaration.name}")`;
					type = undefined;
					const name = declaration.name;
					const name_symbol =
						state.type_checker.getSymbolAtLocation(name);
					if (!name_symbol) throw new Error("expected symbol");
					if (!ts.isIdentifier(name)) throw new Error("expected id");
					state.stateful_symbols.set(name_symbol, name);

					exclaimationToken = undefined;
				}
			}
			declarations.push(
				factory.updateVariableDeclaration(
					declaration,
					declaration.name,
					exclaimationToken,
					type,
					initializer,
				),
			);
			continue declarations;
		}
		if (is_component && declaration_symbol) {
			state.current_component!.symbols_defined_by_component.add(
				declaration_symbol,
			);
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
