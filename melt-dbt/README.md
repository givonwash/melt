# `melt-dbt`

The "T" in ELT, a [DBT](https://www.getdbt.com/) project that "molds" the disparate sources of data
`melt` serves up into proper "consumption-ready" shapes.

## Project Structure

> [!NOTE]
> For a more in-depth look at how and why this project is structured the way it is, take a look
> at [DBT's _How we structure our dbt projects_ guide](https://docs.getdbt.com/guides/best-practices/how-we-structure/1-guide-overview).

This project adheres (where possible) to [DBT's best practices around
styling](https://docs.getdbt.com/best-practices/how-we-style/0-how-we-style-our-dbt-projects). This
adherence includes how this project is structured and how models build off one another.

In general, when DBT builds the top-level, consumption-ready
[marts](https://docs.getdbt.com/best-practices/how-we-structure/4-marts) in this project, the flow
of data looks like the following:

```
                                     --> (intermediate staging models) -->
                                    /                                     \
(source models) --> (staging models) --------------------------------------> (marts)
                                    \                                     /
                                     ---> (intermediate marts models) --->
```

As visual reference for the following sections, a slimmed down skeleton layout of `melt-dbt`
is provided below:

<a id="melt-dbt-layout"></a>

```
.
├── macros
│   ├── _macros.yml
│   └── {macro_name}.sql
└── models
    ├── marts                                                  # See "Marts" below
    │   ├── core
    │   │   ├── _core__models.yml
    │   │   └── {entity}.sql
    │   ├── {function}
    │   │   ├── _{function}__models.yml
    │   │   └── {entity}.sql
    │   └── intermediate
    │       ├── _intermediate__models.yml
    │       └── int_{transformation}.sql
    ├── sources                                                # See "Sources" below
    │   └── {source}
    │       ├── _{source}__sources.yml
    │       └── src_{source}__{table}.sql
    └── staging                                                # See "Staging" below
        └── {source}
            ├── _{source}__models.yml
            ├── stg_{source}__{table}.sql
            └── intermediate
                └── int_{source}__{transformation}.sql
```

### Marts

> This is the layer where everything comes together and we start to arrange all of our atoms
> (staging models) and molecules (intermediate models) into full-fledged cells that have identity
> and purpose. We sometimes like to call this the _entity layer_ or _concept layer_, to emphasize
> that all our marts are meant to represent a specific entity or concept at its unique grain
>
> — _How we structure our dbt projects_, _Marts: Business-defined entities_, DBT Documentation [^1]

**Marts** are models that allow data consumers to answer business specific questions without having
to worry about what went into producing the data.

In the world of programming language libraries, library authors have to think about the _public API_
(i.e., interface) that they want to expose to their end users. This is something that authors will
think long and hard about as once they commit to a public API, every change to it that comes after
is a **breaking change**.

A similar process should be undertaken when determining the "API" exposed by models under the
`models/marts` directory (i.e., a "design" process that thinks about what names and types fields
should have and for what models).

#### Directory Structure

In the [`melt-dbt` skeleton layout above](#melt-dbt-layout), there are two types of directories
under `models/marts` – (1) models grouped by `{function}` and (2) models belonging to an
`intermediate` transformation layer.

Models of the former type share a similar purpose and provide similar data with other models
belonging to their group. Examples of `{function}`'s could be `finance`, `shop`, `marketing`, etc.
If a mart model is general enough that it useful across all all `{function}`'s, then it belongs to
the `models/marts/core` directory. File names for these models should be short and descriptive
(i.e., no need for a prefixing scheme like what's for models under [`models/staging`](#Staging)).

Models of the latter type provide necessary intermediate transformations needed to produce other
models under `models/marts`. These models differ from the intermediate transformations under
[`models/staging/{source}/intermediate`](#Staging) as they transform staged data from _multiple
sources_ into a useful format rather than staged data from a single source. File names for these
models should be prefixed with `int_` followed by a brief description of the `{transformation}` it
performs (e.g., `int_crunchbase_companies_joined_with_product_companies.sql`)

### Sources

> Sources make it possible to name and describe the data loaded into your warehouse by your Extract
> and Load tools.
>
> — _Add sources to your DAG_, _Using sources_, DBT Documentation [^2]

**Sources** are the _raw_ data loaded by external (potentially third-party) tooling into
`dbt`-accessible data stores. In the case of `melt-dbt`, an example of a source would be
[Faker](https://docs.airbyte.com/integrations/sources/faker/) data loaded into [`melt-infra`'s
Postgres database](../melt-infra/src/postgres.ts).

#### Directory Structure

To declare a source with the name `{source}` in this project, a file that looks something like
the following should be placed at `models/sources/{source}/_{source}__sources.yml`:

```yaml
version: 2

sources:
  - name: "{source}"
    description: "{source description}"
    tables:
      - name: "{source_table}"
        columns:
          - name: "{source_table_column}"
          # ... more columns (if necessary)
      # ... more tables (if necessary)
  # ... more sources (if necessary)
```

For each table with name `{name}` declared in `_{source}__sources.yml`, there should be a model file
that looks like the following placed at `models/sources/_src_{source}__{name}.sql`:

```sql
with source as (
  select * from {{ source('{source}', '{name}') }}
)

select * from source
```

With `src_{source}__{name}.sql` in place, models under `models/staging/{source}`, and only models
under `models/staging/{source}`, should reference source data using the DBT-provided
[`ref`](https://docs.getdbt.com/reference/dbt-jinja-functions/ref) macro like so:

```sql
with source as (
  select * from {{ ref('src_{source}__{name}') }}
)

-- do some stuff
```

### Staging

> The staging layer is \[...\] the foundation of our project, where we bring all the individual
> components we're going to use to build our more complex and useful models into the project.
>
> — _How we structure our dbt projects_, _Staging: Preparing our atomic building blocks_, DBT Documentation [^3]

**Staging** models are the building blocks of all (non-source) models in a DBT project. These models
have the same level of granularity as their [source](#Sources) counterparts, but have been renamed,
recast, and reshaped into a more usable and consistent format.

[DBT's guide on staging
models](https://docs.getdbt.com/guides/best-practices/how-we-structure/2-staging#staging-models)
provides useful rules on what types of transformations should occur at this transformation layer. To
summarize them succintly here, staging models should only rename and/or type cast fields, perform
basic computation (e.g., converting timestamps to UTC), and categorize records (e.g., `case`
statements).

#### Directory Structure

Each `models/sources/{source}/src_{source}__{name}.sql` model should have a corresponding model at
`models/staging/{source}/stg_{source}__{name}.sql` that performs a subset of any of the
aforementioned allowable staging transformations.

Additionally, if there are source-specific transformations that need to occur before data can be
used by models under `models/marts`, models should be created at
`models/staging/{source}/intermediate/int_{source}__{transformation}.sql` (where `{transformation}`
is a brief description of the transformation the model performs). Unlike other staging models, there
are no restrictions on what transformations should occur at this transformation layer.

[^1]: https://docs.getdbt.com/best-practices/how-we-structure/4-marts
[^2]: https://docs.getdbt.com/docs/build/sources#using-sources
[^3]: https://docs.getdbt.com/best-practices/how-we-structure/2-staging
