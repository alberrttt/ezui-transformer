import {
	Expression,
	Identifier,
	JsxAttribute,
	Statement,
	SyntaxKind,
	consumesNodeCoreModules,
	factory,
} from "typescript";
import { Buildable } from "./buildable";
import { Component } from "./component";
import ts from "typescript";
import classes from "../classes.json";
import { assert, print_ast, quote, quoteExpr } from "../util";
import { Err, Ok } from "ts-results";
import { State } from "./state";
import { transform_expression } from "../transformations/transform_expression";
export abstract class Child {
	public real_name?: ts.Identifier;
	public state: State;
	constructor(
		public node: ts.JsxChild,
		public parent_component: Component,
		public parent_ident?: Identifier,
	) {
		this.state = parent_component.state;
	}

	abstract build(): TResult<readonly [Identifier | undefined, Statement[]]>;
}
export class JsxExpressionClass extends Child {
	public expression!: Expression;
	constructor(
		public node: ts.JsxExpression,
		public parent_component: Component,
		public parent_ident: Identifier,
	) {
		super(node, parent_component, parent_ident);
		if (!node.expression) {
			return;
		}
		this.expression = node.expression;
	}

	public build(): TResult<readonly [Identifier | undefined, Statement[]]> {
		if (!this.expression) {
			return Err([
				ts.createDiagnosticForNode(this.node, {
					key: "",
					category: ts.DiagnosticCategory.Error,
					code: 0,
					message: "jsx expressions must have an expression!",
				}),
			]);
		}
		const statements = new Array<Statement>();
		let ident: Identifier;
		if (ts.isIdentifier(this.expression)) {
			ident = this.expression;
		} else {
			ident = this.parent_component.allocate_variable(
				`${this.parent_ident.text}_jsx_expression`,
			);
			statements.push(quote`const ${ident.text} = ${this.expression}`);
		}
		statements.push(quote`${ident}.Parent = ${this.parent_ident}`);
		return Ok([ident, statements]);
	}
}
export class ElementClass extends Child {
	public tag_name!: string;
	public class_name?: string;
	public children = new Array<Child>();

	public set_parent = true;

	constructor(
		public node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment,
		public parent_component: Component,
		public parent_ident?: Identifier,
	) {
		super(node, parent_component, parent_ident);
		if (ts.isJsxFragment(node) || ts.isJsxElement(node)) {
			for (const child of node.children) {
				if (
					ts.isJsxElement(child) ||
					ts.isJsxSelfClosingElement(child) ||
					ts.isJsxFragment(child)
				) {
					this.children.push(
						new ElementClass(child, parent_component, parent_ident),
					);
				}

				if (ts.isJsxExpression(child)) {
					this.children.push(
						new JsxExpressionClass(
							child,
							parent_component,
							parent_ident!,
						),
					);
				}
			}
		}
		if (ts.isJsxFragment(node)) {
			this.tag_name = "fragment";
		} else {
			if (ts.isJsxSelfClosingElement(node)) {
				this.tag_name = node.tagName.getText();
			}
			if (ts.isJsxElement(node)) {
				this.tag_name = node.openingElement.tagName.getText();
			}

			const is_intrinsic = ts.isIntrinsicJsxName(this.tag_name);
			if (is_intrinsic) {
				if (!(this.tag_name in classes)) {
					return;
				}
				this.class_name =
					classes[this.tag_name as keyof typeof classes];
			}
		}
	}
	public transform_initializer(attribute: JsxAttribute) {
		const initializer_1 = attribute.initializer;
		if (!initializer_1) throw new Error("expected initializer");
		let initializer_2: ts.Expression = initializer_1;
		if (ts.isJsxExpression(initializer_1)) {
			if (!initializer_1.expression)
				throw new Error("expected expression");
			initializer_2 = initializer_1.expression;
		}

		const result = this.state.capture_stateful_dependencies(() =>
			transform_expression(initializer_2, this.state).unwrap(),
		);
		return result;
	}
	public build(): TResult<readonly [Identifier | undefined, Statement[]]> {
		const statements = new Array<Statement>();
		if (ts.isJsxFragment(this.node)) {
			for (const child of this.children) {
				child.parent_ident = this.parent_ident;

				const _result = child.build();
				const inner = _result.unwrap();
				statements.push(...inner[1]);
			}
			return Ok([undefined, statements]);
		}
		const node = this.node;
		const opening_tag = ts.isJsxElement(node) ? node.openingElement : node;
		const ident = this.parent_component.allocate_variable(
			this.tag_name.toLowerCase(),
		);
		if (this.class_name === undefined) {
			const props = new Array<ts.PropertyAssignment>();
			for (const property of opening_tag.attributes.properties) {
				if (ts.isJsxAttribute(property)) {
					const [initializer, deps] =
						this.transform_initializer(property);

					props.push(
						factory.createPropertyAssignment(
							factory.createStringLiteral(
								property.name.getText(),
							),
							initializer,
						),
					);
				}
			}
			statements.push(
				quote`const ${ident} = ${
					this.tag_name
				}( ${factory.createObjectLiteralExpression(props)},${
					this.parent_ident
				})`,
			);
			return Ok([ident, statements]);
		}

		statements.push(
			quote`const ${ident} = new Instance("${this.class_name}")`,
		);
		if (this.set_parent)
			statements.push(
				quote`${ident}.Parent = ${this.parent_ident || "__parent__"}`,
			);

		for (const property of opening_tag.attributes.properties) {
			if (ts.isJsxAttribute(property)) {
				const name = property.name;
				if (ts.isJsxNamespacedName(name)) continue;

				const [initializer, deps] =
					this.transform_initializer(property);
				if (name.text.startsWith("on")) {
					const event_name = name.text.slice(2);
					statements.push(
						quote`${ident}["${event_name}"].Connect(${initializer})`,
					);
					continue;
				}
				const ty = this.state.type_checker.getTypeAtLocation(property);
				const assignment = quote`${ident}["${name.getText()}"] = ${initializer}`;
				``;
				statements.push(assignment);

				if (deps.length > 0) {
					if (this.state.is_verbose) {
						console.log(
							`${ident.text} depends on ${deps.length} dependenc(y/ies)`,
						);
					}
					const idents = deps.map(
						(symbol) => this.state.stateful_symbols.get(symbol)!,
					);
					statements.push(
						quote`ezui.render_effect(() => { ${assignment} }, ${factory.createArrayLiteralExpression(
							idents,
						)})`,
					);
				}
			}
		}

		for (const child of this.children) {
			child.parent_ident = ident;

			const _result = child.build();
			if (_result.ok) {
				const inner = _result.val;
				const [child_ident, child_statements] = inner as [
					Identifier,
					Statement[],
				];
				statements.push(...child_statements);
			}
		}

		return Ok([ident, statements]);
	}
}
