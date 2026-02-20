import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UNIQUE_BUDGET_CODES } from "../../constants/budgetCodes";
import { useUpdateProject } from "../../hooks/queries/useProjects";

interface BudgetConfig {
  totalBudget: number;
  byCode: Record<number, number>;
}

export default function BudgetSettingsSection({
  project,
}: {
  project: { id: string; budgetConfig: BudgetConfig; documentNo: string };
}) {
  const { t } = useTranslation();
  const updateProject = useUpdateProject();
  const budget = project.budgetConfig ?? { totalBudget: 0, byCode: {} };
  const docNo = project.documentNo ?? "";

  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState<BudgetConfig>(budget);
  const [savingBudget, setSavingBudget] = useState(false);
  const [editingDocNo, setEditingDocNo] = useState(false);
  const [tempDocNo, setTempDocNo] = useState(docNo);
  const [savingDocNo, setSavingDocNo] = useState(false);

  const handleSaveBudget = () => {
    setSavingBudget(true);
    updateProject.mutate(
      { projectId: project.id, data: { budgetConfig: tempBudget } },
      {
        onSuccess: () => {
          setEditingBudget(false);
          setSavingBudget(false);
        },
        onError: () => {
          setSavingBudget(false);
        },
      },
    );
  };

  const handleSaveDocNo = () => {
    setSavingDocNo(true);
    updateProject.mutate(
      { projectId: project.id, data: { documentNo: tempDocNo } },
      {
        onSuccess: () => {
          setEditingDocNo(false);
          setSavingDocNo(false);
        },
        onError: () => {
          setSavingDocNo(false);
        },
      },
    );
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">
            {t("dashboard.budgetSettings")}
          </h3>
          {!editingBudget ? (
            <button
              onClick={() => {
                setTempBudget(budget);
                setEditingBudget(true);
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t("common.edit")}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingBudget(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSaveBudget}
                disabled={savingBudget}
                className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {savingBudget ? t("common.saving") : t("common.save")}
              </button>
            </div>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">
            {t("dashboard.totalBudget")}
          </label>
          {editingBudget ? (
            <input
              type="number"
              value={tempBudget.totalBudget || ""}
              onChange={(e) =>
                setTempBudget({
                  ...tempBudget,
                  totalBudget: parseInt(e.target.value) || 0,
                })
              }
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-48"
              placeholder="0"
            />
          ) : (
            <p className="text-sm font-medium">
              {"\u20A9"}
              {budget.totalBudget.toLocaleString()}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">Code</th>
                <th className="text-left py-2">{t("field.comments")}</th>
                <th className="text-right py-2">
                  {t("dashboard.allocatedBudget")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {UNIQUE_BUDGET_CODES.map((code) => (
                <tr key={code}>
                  <td className="py-2 font-mono">{code}</td>
                  <td className="py-2 text-gray-500">
                    {t(`budgetCode.${code}`)}
                  </td>
                  <td className="py-2 text-right">
                    {editingBudget ? (
                      <input
                        type="number"
                        value={tempBudget.byCode[code] || ""}
                        onChange={(e) =>
                          setTempBudget({
                            ...tempBudget,
                            byCode: {
                              ...tempBudget.byCode,
                              [code]: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full sm:w-36 text-right"
                        placeholder="0"
                      />
                    ) : (
                      <span>
                        {budget.byCode[code]
                          ? `\u20A9${budget.byCode[code].toLocaleString()}`
                          : "-"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {(() => {
              const cb = editingBudget ? tempBudget : budget;
              const codeTotal = Object.values(cb.byCode).reduce(
                (s, v) => s + (v || 0),
                0,
              );
              const diff = codeTotal - cb.totalBudget;
              const hasTotal = cb.totalBudget > 0;
              return (
                <tfoot className="border-t">
                  <tr>
                    <td colSpan={2} className="py-2 text-right font-medium">
                      {t("dashboard.codeTotal")}
                    </td>
                    <td className="py-2 text-right font-bold">
                      {"\u20A9"}
                      {codeTotal.toLocaleString()}
                    </td>
                  </tr>
                  {hasTotal && diff !== 0 && (
                    <tr>
                      <td colSpan={2} className="py-2 text-right font-medium">
                        {t("dashboard.difference")}
                      </td>
                      <td
                        className={`py-2 text-right font-bold ${diff > 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {diff > 0 ? "+" : ""}
                        {`\u20A9${diff.toLocaleString()}`}
                      </td>
                    </tr>
                  )}
                  {hasTotal && diff === 0 && (
                    <tr>
                      <td colSpan={2} className="py-2 text-right font-medium">
                        {t("dashboard.difference")}
                      </td>
                      <td className="py-2 text-right font-bold text-green-600">
                        {"\u20A9"}0
                      </td>
                    </tr>
                  )}
                </tfoot>
              );
            })()}
          </table>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">
            {t("dashboard.documentNoSettings")}
          </h3>
          {!editingDocNo ? (
            <button
              onClick={() => {
                setTempDocNo(docNo);
                setEditingDocNo(true);
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t("common.edit")}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingDocNo(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSaveDocNo}
                disabled={savingDocNo}
                className="text-sm text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {savingDocNo ? t("common.saving") : t("common.save")}
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t("dashboard.documentNo")}
          </label>
          {editingDocNo ? (
            <input
              type="text"
              value={tempDocNo}
              onChange={(e) => setTempDocNo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full font-mono"
              placeholder="KOR01-6762808-5xxx-KYSA2025KOR"
            />
          ) : (
            <p className="text-sm font-mono font-medium">
              {docNo || t("dashboard.notSet")}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {t("dashboard.documentNoHint")}
          </p>
        </div>
      </div>
    </>
  );
}
