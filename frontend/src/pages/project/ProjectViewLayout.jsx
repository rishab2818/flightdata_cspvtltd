// frontend/src/pages/project/ProjectViewLayout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { projectsApi } from "../../lib/api";

export default function ProjectViewLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const p = await projectsApi.get(projectId);
      setProject(p);
    } catch (e) {
      setErr(e.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const createdStr = useMemo(() => {
    if (!project?.created_at) return "";
    try {
      return new Date(project.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    } catch { return ""; }
  }, [project?.created_at]);

  return (
    <div className="space-y-4">
      <button className="text-sm text-blue-600" onClick={() => navigate(-1)}>← Back</button>

      {/* header card */}
      {project && (
        <div className="rounded-xl bg-white border p-5">
          <div className="font-semibold">
            {project.title}
            <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded">Aero Data</span>
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
          </div>
          <div className="text-sm text-gray-600 mt-2">{project.description}</div>
          <div className="flex gap-8 mt-3 text-sm">
            <div><div className="text-gray-500">Created</div><div className="font-semibold">{createdStr}</div></div>
            <div><div className="text-gray-500">Members</div><div className="font-semibold">{String(project.members?.length || 0).padStart(2,"0")}</div></div>
          </div>
        </div>
      )}

      {/* Tabs header lives in AppShell (sidebar). Here we just render active tab content */}
      <div className="rounded-xl bg-white border">
        <div className="p-4">
          {loading && <div className="text-sm text-gray-600">Loading…</div>}
          {err && <div className="text-sm text-red-600">{err}</div>}
          {project && <Outlet context={{ project, reload: load }} />}
        </div>
      </div>
    </div>
  );
}
