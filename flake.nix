{
  description = "melt: (M)y End-to-end (ELT)";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOs/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, flake-utils, nixpkgs }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            kind
            kubectl
            kubernetes-helm
            nodejs_22
            nodePackages.cdk8s-cli
            poetry
            postgresql
            python312
          ];
        };
      });
}
