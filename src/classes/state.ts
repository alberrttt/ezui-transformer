import ts, { BindingName, SymbolFlags } from "typescript";
import * as path from "path";
import { transform_node } from "../transformations/transform_node";
import { Component } from "./component";
export class State {
	public current_component?: Component;
	public has_collected_info = false;
	public stateful_symbols = new Map<ts.Symbol, ts.Identifier>();
	public type_checker = this.program.getTypeChecker();
	constructor(
		public program: ts.Program,
		public config: TransformerConfig,
		public ctx: ts.TransformationContext,
		public is_verbose: boolean,
	) {}
	public symbol_is_defined_by_component(symbol: ts.Symbol): boolean {
		return (
			this.current_component?.symbols_defined_by_component.has(symbol) ??
			false
		);
	}
	public symbol_is_stateful(symbol: ts.Symbol): boolean {
		const is_alias = (symbol.flags & SymbolFlags.Alias) !== 0;
		const is_transient = (symbol.flags & SymbolFlags.Transient) !== 0;
		const resolved_alias = is_alias
			? this.type_checker.getAliasedSymbol(symbol)
			: undefined;
		if (resolved_alias) {
			symbol = resolved_alias;
		}
		if (is_transient) {
			const transient_symbol = symbol as ts.TransientSymbol;
			const target = transient_symbol.links.target;
			if (target) {
				symbol = target;
			}
		}

		return this.stateful_symbols.has(symbol);
	}
	/**
	 * also resolves aliases
	 */
	public symbol_is_macro(symbol: ts.Symbol, name: string): boolean {
		const is_aliased = (symbol.flags & SymbolFlags.Alias) !== 0;
		const resolved_alias = is_aliased
			? this.type_checker.getAliasedSymbol(symbol)
			: undefined;

		return this.macro_declarations.get(name) === (resolved_alias || symbol);
	}

	public collect_info() {
		this.has_collected_info = true;

		for (const file of this.program.getSourceFiles()) {
			collect_file_info(file, this);
		}
	}
	public capture_prereqs<T>(fn: () => T): [T, ts.Statement[]] {
		const result = fn();
		const prereqs = this.prereqs;
		this.prereqs = [];
		return [result, prereqs];
	}
	public transform<T extends ts.Node>(node: ts.Node): T {
		return ts.visitEachChild(
			node,
			(child) => {
				const result = transform_node(child, this);
				if (result.err) {
					for (const error of result.val) {
						this.ctx.addDiagnostic(error);
					}
					return child;
				} else {
					return result.val;
				}
			},
			this.ctx,
		) as T;
	}
	public macro_declarations = new Map<string, ts.Symbol>();

	public prereqs = new Array<ts.Statement>();

	/**
	 * maps `namespace component { ... }`
	 */
	public symbols_of_components = new Map<ts.Symbol, Component>();

	public capture_info<T>(cb: () => T): [T, State["info"]] {
		this.info = {
			is_$state_macro: false,
			is_$derived_macro: false,
		};
		const res = cb();
		const info = this.info;

		return [res, info];
	}

	public stateful_dependencies = new Array<ts.Symbol>();
	public capture_stateful_dependencies<T>(cb: () => T): [T, ts.Symbol[]] {
		this.stateful_dependencies = [];
		const res = cb();
		const deps = this.stateful_dependencies;

		return [res, deps];
	}

	public info = {
		is_$state_macro: false,
		is_$derived_macro: false,
	};
}

export class VarDecl {
	constructor(public name: ts.BindingName) {}
}

function collect_file_info(file: ts.SourceFile, state: State) {
	const file_name = file.fileName;
	const normalizedPath = path.normalize(file_name);

	const pathComponents = normalizedPath.split(path.sep);
	const ezuiIndex = pathComponents.indexOf("ezui-core");

	if (ezuiIndex === -1 || ezuiIndex >= pathComponents.length - 2) {
		return;
	}

	if (pathComponents[ezuiIndex + 1] !== "out") {
		return;
	}

	if (state.is_verbose) {
		console.log(`\tcollecting info for ${file_name}`);
	}

	function visit(node: ts.Node) {
		if (ts.isFunctionDeclaration(node)) {
			const name = node.name?.getText();
			if (name?.startsWith("$")) {
				if (state.is_verbose) {
					console.log(`\t\tfound macro ${name}`);
				}
				const symbol = state.program
					.getTypeChecker()
					.getSymbolAtLocation(node.name!);
				if (symbol) {
					state.macro_declarations.set(name, symbol);
				}
			}
		}
		ts.forEachChild(node, visit);
	}

	ts.forEachChild(file, visit);
}
