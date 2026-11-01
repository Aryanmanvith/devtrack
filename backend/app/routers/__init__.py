from app.routers import insights, issues, projects, system, tasks

ALL_ROUTERS = [system.router, projects.router, tasks.router, issues.router, insights.router]
