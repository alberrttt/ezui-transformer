import ts from "typescript";

export abstract class Buildable {   
	public abstract build(): ts.Statement[];
}
