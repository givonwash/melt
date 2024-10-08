# melt: (M)y End-to-End (ELT)

End-to-end ELT pipeline(s) that make(s) use of a variety of "cloud native" technologies:

- [Kubernetes](https://kubernetes.io/) for container orchestration (with manifest creation aided by [Amazon's `cdk8s` "cloud development kit"](https://cdk8s.io/))
- [Argo Workflows](https://argoproj.github.io/workflows/) for pipeline orchestration
- [Airbyte](https://airbyte.com/) for data synchronization (the "extract" and "load" in ELT)
- [DBT](https://www.getdbt.com/) for data transformations (the "transform" in ELT)
- [Postgres](https://www.postgresql.org/) as a final destination data store

as well as [Nix](https://nix.dev/manual/nix/2.18/) and [Nix Flakes](https://nix.dev/manual/nix/2.18/command-ref/new-cli/nix3-flake) for project dependency and build management.

## Why `melt`?

`melt` was developed with the intention of:

1. making myself ([@givonwash](https://github.com/givonwash)) more familiar with a variety of tools/technologies that I had limited prior experience with (e.g., Kubernetes)
2. demonstrating mastery of tools/technologies that I ([@givonwash](https://github.com/givonwash)) do have extensive experience in (e.g., `dbt`, Postgres, Nix, etc.)

`melt` is not production-grade software and exists primarily for demonstration purposes!

## How It Works

> [!NOTE]
> This project is in a (semi-)working state as of [`9ec85f9`](https://github.com/givonwash/melt/tree/9ec85f9ca3b198bcae7198be3b92ce209c35d26d); however, there are still a few "quirks" to be worked out and as such, this project should not be considered "finished"

At its core, `melt` relies upon three different technologies to do the heavy lifting of container orchestration and data extraction: Kubernetes, Argo Workflows, and Airbyte. The latter two technologies "sit" atop the former and are configured/utilized via the logic residing under [`./melt-infra`](./melt-infra).

`melt`'s usage of Argo Workflows revolves around a single workflow, [`elt-workflow`](./melt-infra/src/argo-workflows/index.ts), which handles the configuration of Airbyte, triggering of data synchronization jobs, DBT transformations, and more. `elt-workflow` is created as a [`CronWorkflow`](https://argo-workflows.readthedocs.io/en/stable/cron-workflows/) that runs every other hour. An in-progress run of `elt-workflow`, as visualized by Argo Workflows's UI, can be seen below:

![In-progress `elt-workflow` run as seen from the Argo Workflows UI](./assets/elt-workflow-in-progress.png)

The [DBT project](https://docs.getdbt.com/docs/build/projects) responsible for transforming data extracted and loaded by the `elt-workflow` is found under [`./melt-dbt`](./melt-dbt). `melt-dbt` adheres to [DBT’s enumerated “best practices”](https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview) of “staging”, “intermediate”, and “mart” transformation layers, with each layer molding data into an increasingly usable shape. A `melt-dbt` Docker image is uploaded to [`givonwash/melt-dbt`](https://hub.docker.com/repository/docker/givonwash/melt-dbt/general) upon pushes to `main` via the [`build/build-melt-dbt` GitHub Actions job](./.github/workflows/build.yaml).

## Usage

> [!NOTE]
> This project was developed for demonstration purposes and has not been thoroughly tested against non-[`minikube`](https://minikube.sigs.k8s.io/docs/) Kubernetes clusters. **Please proceed with caution &/or expect errors if deploying `melt` outside of this context.**

### With [`nix`](https://nixos.org/)

If you have the Nix package manager installed, and configured to use the `extra-experimental-features` `flakes` and `nix-command`, this project can be made use of as follows:

```bash
# Make use of `devShells.default`
nix develop

# Start our `minikube` K8s cluster
minikube start

# Change to `melt-infra` to generate needed K8s manifests
cd melt-infra

# Generate ("synthesize") K8s manifests
#
# NOTE:
#   1. Alternatively these options can be defined as environment variables instead to protect secret
#      credentials
#   2. To see descriptions for these options, execute `npx tsx src/synth.ts --help`
npx tsx src/synth.ts --airbyte-namespace '<airbyte-namespace>' \
                     --airbyte-server-url '<airbyte-server-url>' \
                     --argo-namespace '<argo-namespace>' \
                     --postgres-namespace '<postgres-namespace>' \
                     --postgres-database '<postgres-database>' \
                     --postgres-admin-password '<postgres-admin-password>' \
                     --postgres-melt-user '<postgres-melt-user>' \
                     --postgres-melt-password '<postgres-melt-password>'

# Apply generated K8s manifests
#
# NOTE: you may have to run this command more than once if your K8s cluster fails to register Argo
#       Workflows CRDs quickly enough to avoid "missing definition" errors resulting from K8s
#       creating `CronWorkflows` (& the like) per the logic in `melt-infra`
kubectl apply -f dist/

# Optional: Monitor the various deployments/services/pods/etc. created by the previous command
minikube dashboard

# Optional: Monitor the `elt-workflow` by visiting http://localhost:2746 and pasting your access
#           token (printed to `stdout` by the second command below) into the relevant text box
#
#           Be sure to swap `${ARGO_WORKFLOWS_SERVER_SERVICE_NAME}` with your actual service name,
#           `${ARGO_WORKFLOWS_READER_SERVICE_ACCOUNT_SECRET}` with your actual service account
#           secret, and `<argo-namespace>` with the value passed to `--argo-namespace` above
kubectl port-forward --namespace='<argo-namespace>' service/${ARGO_WORKFLOWS_SERVER_SERVICE_NAME} 2746:2746
echo "Bearer $(kubectl get --namespace='<argo-namespace>' secret ${ARGO_WORKFLOWS_READER_SERVICE_ACCOUNT_SECRET} -o=jsonpath='{.data.token}' | base64 --decode)"
```

### Without [`nix`](https://nixos.org/)

`melt` relies upon, and encourages the usage of, Nix Flakes for build/dependency management; however, it is possible to make use of this project without installing the Nix package manager as well. To do so, you'll need to have [`helm`](https://helm.sh/), [`minikube`](https://minikube.sigs.k8s.io/docs/), [`kubectl`](https://kubernetes.io/docs/reference/kubectl/kubectl/), and [Node.js v22](https://nodejs.org/en) installed via your preferred package management solution.

```bash
# Start our `minikube` K8s cluster
minikube start

# Change to `melt-infra` to generate needed K8s manifests
cd melt-infra

# Install the dependencies of `melt-infra`
npm install

# Generate ("synthesize") K8s manifests
#
# NOTE:
#   1. Alternatively these options can be defined as environment variables instead to protect secret
#      credentials
#   2. To see descriptions for these options, execute `npx tsx src/synth.ts --help`
npx tsx src/synth.ts --airbyte-namespace '<airbyte-namespace>' \
                     --airbyte-server-url '<airbyte-server-url>' \
                     --argo-namespace '<argo-namespace>' \
                     --postgres-namespace '<postgres-namespace>' \
                     --postgres-database '<postgres-database>' \
                     --postgres-admin-password '<postgres-admin-password>' \
                     --postgres-melt-user '<postgres-melt-user>' \
                     --postgres-melt-password '<postgres-melt-password>'

# Apply generated K8s manifests
#
# NOTE: you may have to run this command more than once if your K8s cluster fails to register Argo
#       Workflows CRDs quickly enough to avoid "missing definition" errors resulting from K8s
#       creating `CronWorkflows` (& the like) per the logic in `melt-infra`
kubectl apply -f dist/

# Optional: Monitor the various deployments/services/pods/etc. created by the previous command
minikube dashboard

# Optional: Monitor the `elt-workflow` by visiting http://localhost:2746 and pasting your access
#           token (printed to `stdout` by the second command below) into the relevant text box.
#
#           NOTE: You'll need the `base64` utility program as well for the second command to work.
#
#           Be sure to swap `${ARGO_WORKFLOWS_SERVER_SERVICE_NAME}` with your actual service name,
#           `${ARGO_WORKFLOWS_READER_SERVICE_ACCOUNT_SECRET}` with your actual service account
#           secret, and `<argo-namespace>` with the value passed to `--argo-namespace` above
kubectl port-forward --namespace='<argo-namespace>' service/${ARGO_WORKFLOWS_SERVER_SERVICE_NAME} 2746:2746
echo "Bearer $(kubectl get --namespace='<argo-namespace>' secret ${ARGO_WORKFLOWS_READER_SERVICE_ACCOUNT_SECRET} -o=jsonpath='{.data.token}' | base64 --decode)"
```
