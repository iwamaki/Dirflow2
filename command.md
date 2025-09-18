# よく使うコマンド

## dependency-cruiser
### .dot取得
npx dependency-cruiser --config .dependency-cruiser.cjs --output-type dot --output-to dependency-graph.dot public/src
### .svg取得
dot -Tsvg dependency-graph.dot -o dependency-graph.svg

