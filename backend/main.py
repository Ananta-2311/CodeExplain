from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from controller.explanation_controller import router as explanation_router
from controller.visualization_controller import router as visualization_router
from view.main_view import router as view_router

app = FastAPI(title="CodeMuse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


app.include_router(explanation_router)
app.include_router(visualization_router)
app.include_router(view_router)


