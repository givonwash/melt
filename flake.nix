{
  description = "melt: (M)y End-to-end (ELT)";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixpkgs.url = "github:NixOs/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, flake-utils, git-hooks, nixpkgs }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          inherit (self.checks.${system}.gitHooks) shellHook;
          buildInputs = with pkgs; [
            self.checks.${system}.gitHooks.enabledPackages
            kubectl
            kubernetes-helm
            minikube
            nodejs_22
            poetry
            postgresql
            python312
          ];
        };

        checks = {
          gitHooks = git-hooks.lib.${system}.run {
            src = ./.;
            hooks = {
              end-of-file-fixer.enable = true;
              nixpkgs-fmt.enable = true;
            };
          };
        };
      });
}
