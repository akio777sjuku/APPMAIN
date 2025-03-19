#!/bin/sh

echo ""
echo "Loading azd .env file from current environment"
echo ""

while IFS='=' read -r key value; do
    value=$(echo "$value" | sed 's/^"//' | sed 's/"$//')
    export "$key=$value"
done <<EOF
$(azd env get-values)
EOF

echo 'Running "prepdocs.py"'
./scripts/.venv/bin/python ./scripts/prepdocs.py './data/*' --openaikey "13ab2e7e742b459bbb953dd98cba986a" --searchkey "Gp47vlodZxMYVomPdGATR9klmTOSzVfvAAaMQKk7gaAzSeDRDNeH" --formrecognizerkey "8de8cea71f744188bebfe86f3003ee3c" --storagekey "OGGeRwPnpAQrAPQqbw5x/d7U8drJLP2DzSmahXm081zqI6Lu3PvlEOroxuxFrDDVhOwYz7+x7o+C+AStEWglIg==" --storageaccount "$AZURE_STORAGE_ACCOUNT" --container "$AZURE_STORAGE_CONTAINER" --searchservice "$AZURE_SEARCH_SERVICE" --openaiservice "$AZURE_OPENAI_SERVICE" --openaideployment "$AZURE_OPENAI_EMB_DEPLOYMENT" --index "$AZURE_SEARCH_INDEX" --formrecognizerservice "$AZURE_FORMRECOGNIZER_SERVICE" --tenantid "$AZURE_TENANT_ID" -v
