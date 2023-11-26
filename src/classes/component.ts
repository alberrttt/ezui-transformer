import ts, {
	CallExpression,
	Expression,
	Identifier,
	TypeNode,
	VariableDeclaration,
	VariableStatement,
	factory,
} from "typescript";
import { State } from "./state";
import {
	is_$render_call,
	is_$render_statement,
	print_ast,
	quote,
} from "../util";
import { ElementClass } from "./element";
import { transform_expression } from "../transformations/transform_expression";
import { transform_variable_statement } from "../transformations/transform_variable_statement";
interface Variable {
	is_$state: boolean;
}

export class Component {
	// use this to generate unique identifiers
	public ident_count = new Map<string, number>();
	public statements = new Array<ts.Statement>();
	public symbols_defined_by_component = new Set<ts.Symbol>();

	public element: ElementClass | undefined;
	public stateful_symbols = new Map<ts.Symbol, Identifier>();
	public add_variable(
		name: string | ts.Identifier,
		init?: Expression,
		ty?: TypeNode,
	): Identifier {
		const ident = this.allocate_variable(name);
		this.statements.push(
			factory.createVariableStatement(
				[],
				[factory.createVariableDeclaration(name, undefined, ty, init)],
			),
		);
		return ident;
	}
	public allocate_variable(name: string | ts.Identifier): Identifier {
		name = typeof name === "string" ? name : name.text;
		let count = this.ident_count.get(name);
		if (count !== undefined) {
			count++;
			this.ident_count.set(name, count);
		} else {
			this.ident_count.set(name, 1);
		}
		let ident = factory.createIdentifier(`${name}${count || ""}`);

		return ident;
	}
	constructor(
		public readonly module_declaration: ts.ModuleDeclaration & {
			body: ts.ModuleBlock;
		} & {
			name: ts.Identifier;
		},
		public readonly state: State,
		public render_calls: (readonly [ts.Symbol, ts.CallExpression])[],
	) {
		state.current_component = this;
		if (state.is_verbose) {
			console.log(`created ${module_declaration.name.text}`);
		}

		for (const statement of module_declaration.body.statements) {
			if (ts.isVariableStatement(statement)) {
				const [result, prereqs] = state.capture_prereqs(() =>
					transform_variable_statement(statement, state),
				);
				this.statements.push(...prereqs);
				this.statements.push(result);
				continue;
			}
			if (is_$render_statement(statement, state)) {
				continue;
			}
			this.statements.push(state.transform(statement));
		}
		this.state.current_component = undefined;
	}

	public build() {
		const name = this.module_declaration.name;
		const rendered = new Array<ts.Identifier>();
		this.state.current_component = this;

		for (const render_call of this.render_calls) {
			const render_call_expression = render_call[1];
			const render_call_arguments = render_call_expression.arguments;
			if (render_call_arguments.length !== 1) {
				throw new Error("expected 1 argument");
			}
			const render_call_argument = render_call_arguments[0];
			const ty =
				this.state.type_checker.getTypeAtLocation(render_call_argument);
			const alias_symbol = ty.aliasSymbol;

			if (ts.isIdentifier(render_call_argument) && alias_symbol) {
				if (ty.aliasSymbol?.name === "Element") {
					this.statements.push(
						quote`${render_call_argument}.Parent = __parent__`,
					);
					rendered.push(render_call_argument);
				}
			} else if (
				ts.isJsxElement(render_call_argument) ||
				ts.isJsxSelfClosingElement(render_call_argument)
			) {
				const element = new ElementClass(render_call_argument, this);
				const built = element.build().unwrap();
				this.statements.push(...built[1]);
				rendered.push(
					built[0] || factory.createIdentifier("undefined"),
				);
			}
		}

		const prop_ty = this.state.type_checker.getTypeAtLocation(
			this.module_declaration,
		);

		const prop_members = new Array<ts.PropertySignature>();
		prop_ty.getProperties().forEach((prop) => {
			const ty = this.state.type_checker.getTypeOfSymbolAtLocation(
				prop,
				this.module_declaration,
			);

			prop_members.push(
				factory.createPropertySignature(
					[],
					prop.name,
					undefined,
					factory.createParenthesizedType(
						this.state.type_checker.typeToTypeNode(
							ty,
							undefined,
							undefined,
							undefined,
						) || factory.createTypeReferenceNode("never"),
					),
				),
			);
		});
		const final_prop_type = factory.createTypeLiteralNode(prop_members);
		const typeName = factory.createIdentifier(
			`__${this.module_declaration.name.text}__props`,
		);
		this.state.prereqs.push(
			factory.createTypeAliasDeclaration(
				[],
				typeName,
				[],
				factory.createTypeReferenceNode(
					factory.createIdentifier("FCProps"),
					[final_prop_type],
				),
			),
		);

		this.state.current_component = undefined;
		return factory.createFunctionDeclaration(
			this.module_declaration.modifiers,
			undefined,
			this.module_declaration.name,
			[],
			[
				factory.createParameterDeclaration(
					[],
					undefined,
					`__props__`,
					undefined,
					factory.createTypeReferenceNode(typeName),
				),
				factory.createParameterDeclaration(
					[],
					undefined,
					"__parent__",
					undefined,
					factory.createTypeReferenceNode(
						factory.createIdentifier("Instance"),
						undefined,
					),
				),
			],
			undefined,
			factory.createBlock([
				quote`ezui.push(__props__)`,
				...this.statements,
				quote`ezui.pop()`,
				quote`return ${factory.createArrayLiteralExpression(rendered)}`,
			]),
		);
	}
}
