import ts, { factory } from "typescript";

export enum DiagnosticMessageIds {
	RunesAreNotAllowed,
}

export const DiagnosticMessages = new Map<
	DiagnosticMessageIds,
	(node: ts.Node[]) => {
		category: ts.DiagnosticCategory;
		message: string;
	}
>([
	[
		DiagnosticMessageIds.RunesAreNotAllowed,
		(nodes: ts.Node[]) => {
			return {
				category: ts.DiagnosticCategory.Error,
				message: "Runes are not allowed here",
			};
		},
	],
]);
export function GetDiagnosticForNode(
	node: ts.Node,
	message: DiagnosticMessageIds,
) {
	const diagnostic = DiagnosticMessages.get(message);
	if (!diagnostic) throw new Error(`Diagnostic ${message} not found`);
	return ts.createDiagnosticForNode(node, {
		...diagnostic([node]),
		key: "EzUI",
		code: message + 6000,
	});
}
export function GetDiagnosticForNodes(
	nodes: ts.Node[],
	message: DiagnosticMessageIds,
) {
	const diagnostic = DiagnosticMessages.get(message);
	if (!diagnostic) throw new Error(`Diagnostic ${message} not found`);
	return ts.createDiagnosticForNodeArray(
		nodes[0].getSourceFile(),
		factory.createNodeArray(nodes),
		{
			...diagnostic(nodes),
			key: "EzUI",
			code: message + 6000,
		},
	);
}
