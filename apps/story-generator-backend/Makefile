.PHONY: dev generate-models test

generate-models:
	python3 -m datamodel_code_generator \
	  --input ../../packages/schema/schemas/story.v1.json \
	  --input-file-type jsonschema \
	  --output-model-type pydantic_v2.BaseModel \
	  --output src/story_generator/models.py
	python3 -c "import pathlib; p = pathlib.Path('src/story_generator/models.py'); p.write_text('# AUTO-GENERATED from story.v1.json — do not edit manually\n' + p.read_text(encoding='utf-8'), encoding='utf-8')"

dev:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null; true
	@lsof -ti:5174 | xargs kill -9 2>/dev/null; true
	python -m uvicorn story_generator.main:app --port 8000 --reload & \
	BACKEND_PID=$$!; \
	trap "kill $$BACKEND_PID 2>/dev/null" EXIT; \
	cd ../story-generator && pnpm dev

test:
	pytest

spike:
	PYTHONPATH=src python3 -m story_generator.spike
