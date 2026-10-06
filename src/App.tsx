import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ToolRoute } from '@/features/app-shell/ui/ToolRoute';
import { useTranslation } from '@/shared/i18n';
import { DEFAULT_TOOL_PATH, toolPaths } from '@/shared/navigation/toolPaths';

function NotFound() {
    const { t } = useTranslation();
    return <main className="min-h-screen bg-base-100 p-6 text-base-content space-y-6">
        <h1 className="text-3xl font-bold">{t('Page not found')}</h1>
        <Link className="link" to={DEFAULT_TOOL_PATH}>{t('Open Planner')}</Link>
    </main>;
}

function App() {
    return <BrowserRouter>
        <Routes>
            <Route path="/" element={<Navigate to={DEFAULT_TOOL_PATH} replace />} />
            {Object.values(toolPaths).map(path => <Route key={path} path={path} element={<ToolRoute />} />)}
            <Route path="*" element={<NotFound />} />
        </Routes>
    </BrowserRouter>;
}

export default App;
