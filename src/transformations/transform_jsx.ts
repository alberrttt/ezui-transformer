import {
	Expression,
	JsxElement,
	JsxFragment,
	JsxSelfClosingElement,
} from "typescript";
import { State } from "../classes/state";
import { ElementClass } from "../classes/element";
import { assert } from "../util";
import { Ok } from "ts-results";

export function transform_jsx_element_like(
	node: JsxElement | JsxSelfClosingElement | JsxFragment,
	state: State,
): TResult<Expression> {
	assert(state.current_component);
	const ele = new ElementClass(node, state.current_component);
	ele.set_parent = false;
	const [ident, statements] = ele.build().unwrap();
	state.prereqs.push(...statements);
	return Ok(ident!);
}
