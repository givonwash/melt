{
  description = "melt: (M)y End-to-end (ELT)";

  inputs = {
    dbt-utils = {
      flake = false;
      url = "github:dbt-labs/dbt-utils/1.2.0";
    };
    flake-utils.url = "github:numtide/flake-utils";
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixpkgs.url = "github:NixOs/nixpkgs/nixpkgs-unstable";
    poetry2nix = {
      url = "github:nix-community/poetry2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, dbt-utils, flake-utils, git-hooks, nixpkgs, poetry2nix }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        inherit (pkgs)
          lib
          kubectl
          kubernetes-helm
          minikube
          nodejs_22
          postgresql;

        poetry2nix' = import poetry2nix { inherit pkgs; };
        inherit (poetry2nix') defaultPoetryOverrides mkPoetryEnv;

        meltDbtEnv =
          let
            overrides = [
              (_: prev: { dbt-extractor = prev.dbt-extractor.override { preferWheel = true; }; })
              (defaultPoetryOverrides.extend
                (_: prev:
                  let
                    withBuildInputs = pkg: buildInputs: {
                      ${pkg} = prev.${pkg}.overridePythonAttrs (old: {
                        buildInputs = (old.buildInputs or [ ]) ++ buildInputs;
                      });
                    };
                  in
                  withBuildInputs "daff" [ prev.setuptools ]
                  // withBuildInputs "dbt-adapters" [ prev.hatchling ]
                  // withBuildInputs "dbt-common" [ prev.hatchling ]
                  // withBuildInputs "dbt-postgres" [ prev.hatchling ]
                )
              )
            ];
            env = mkPoetryEnv {
              inherit overrides;
              projectDir = ./melt-dbt;
              python = pkgs.python312;
            };
          in
          env.override { ignoreCollisions = true; };

        meltDbtUtils = lib.cleanSource dbt-utils;
      in
      {
        devShells = {
          default = pkgs.mkShell {
            inherit (self.checks.${system}.gitHooks) shellHook;
            buildInputs = [
              self.checks.${system}.gitHooks.enabledPackages
              kubectl
              kubernetes-helm
              minikube
              nodejs_22
              meltDbtEnv
              postgresql
            ];
          };
          poetry = pkgs.mkShell {
            buildInputs = [ pkgs.poetry ];
          };
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

        packages = {
          melt-dbt-project = pkgs.runCommand "melt-dbt-project" { } ''
            mkdir --parents  $out/app/dbt_packages
            cp -r ${./melt-dbt}/* $out/app
            cp -r ${meltDbtUtils} $out/app/dbt_packages/dbt_utils
          '';
          melt-dbt-docker-image =
            pkgs.dockerTools.buildImage {
              name = "melt-dbt";
              copyToRoot = pkgs.buildEnv {
                name = "image-root";
                paths = [ self.packages.${system}.melt-dbt-project ];
                pathsToLink = [ "/app" ];
              };
              config = {
                Entrypoint = [ "${meltDbtEnv}/bin/dbt" ];
                Env = [
                  "DBT_PROFILES_DIR=/app"
                  "DBT_PROJECT_DIR=/app"
                ];
              };
            };
        };
      });
}
