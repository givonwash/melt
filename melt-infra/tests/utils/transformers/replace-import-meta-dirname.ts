import ts, {
  SourceFile,
  TransformationContext,
  Visitor,
  Node,
  TransformerFactory,
} from "typescript";

export const name = "replace-import-meta-dirname";
export const version = "0.0.1";

export function factory(): TransformerFactory<SourceFile> {
  function createVisitor(ctx: TransformationContext) {
    const visitor: Visitor = (node: Node) => {
      if (ts.isPropertyAccessExpression(node)) {
        if (
          ts.isMetaProperty(node.expression) &&
          ts.isIdentifier(node.name) &&
          node.name.getText() === "dirname"
        ) {
          return ts.factory.createIdentifier("__dirname");
        }
      }
      return ts.visitEachChild(node, visitor, ctx);
    };
    return visitor;
  }
  return (ctx) => {
    return (sourceFile) => ts.visitNode(sourceFile, createVisitor(ctx));
  };
}
