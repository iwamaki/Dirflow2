# よく使うコマンド

## dependency-cruiser
npx dependency-cruiser --config .dependency-cruiser.cjs --output-type dot --output-to dependency-graph.dot public/src
dot -Tsvg dependency-graph.dot -o dependency-graph.svg

