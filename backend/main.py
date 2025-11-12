from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from controller.explanation_controller import router as explanation_router
from controller.visualization_controller import router as visualization_router
from controller.suggestion_controller import router as suggestion_router
from controller.history_controller import router as history_router
from controller.settings_controller import router as settings_router
from controller.admin_controller import router as admin_router
from controller.export_controller import router as export_router
from controller.share_controller import router as share_router
from view.main_view import router as view_router
from model.history_model import init_db, get_session, ApiLog
import time

app = FastAPI(title="CodeMuse API")
init_db()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = None
    error_msg = None
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        error_msg = str(e)
        raise
    finally:
        try:
            latency_ms = int((time.perf_counter() - start) * 1000)
            with get_session() as db:
                log = ApiLog(
                    method=request.method,
                    path=request.url.path,
                    status_code=(response.status_code if response else 500),
                    latency_ms=latency_ms,
                    error=error_msg,
                )
                db.add(log)
                db.commit()
        except Exception:
            pass

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
app.include_router(suggestion_router)
app.include_router(history_router)
app.include_router(settings_router)
app.include_router(admin_router)
app.include_router(export_router)
app.include_router(share_router)
app.include_router(view_router)


