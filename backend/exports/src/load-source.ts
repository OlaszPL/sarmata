import { officeIdSchema } from '@sarmata/domain';
import { type Db, createRepositories, findOfficeName } from '@sarmata/repositories';
import { servicesFor } from '@sarmata/services';
import { ExportError } from './errors';
import { type ExportSource, type PersonOnSheet } from './sheet-document';

/**
 * Collects what an export reads, through the services and repositories of one client. With the JWT of
 * the user, RLS decides what is visible, so an evaluation of another office is `null`.
 */
export function loadExportSource(db: Db): (evaluationId: string) => Promise<ExportSource | null> {
  const services = servicesFor(db);
  const repositories = createRepositories(db);
  return async (evaluationId) => {
    const view = await services.evaluations.get(evaluationId);
    if (view === null) return null;
    const storedRegulation = await repositories.regulationVersions.findByCode(view.regulationId);
    if (storedRegulation === null) {
      throw new ExportError('unsupported_regulation', `Regulation ${view.regulationId} not found`);
    }
    const regulation = storedRegulation.document;
    const [officeName, employees, history, sheetVersions] = await Promise.all([
      findOfficeName(db, officeIdSchema.parse(view.officeId)),
      services.employees.list(),
      repositories.evaluations.history(view.employeeId),
      repositories.sheetVersions.listForEvaluation(view.id),
    ]);
    const accountNames = new Map<string, string>();
    for (const employee of employees) {
      if (employee.userId !== null) {
        accountNames.set(employee.userId, `${employee.firstName} ${employee.lastName}`);
      }
    }
    const evaluatorEmployee = employees.find(
      (employee) => employee.userId === view.evaluatorAccountId,
    );
    const evaluator: PersonOnSheet | null =
      evaluatorEmployee === undefined
        ? null
        : {
            firstName: evaluatorEmployee.firstName,
            lastName: evaluatorEmployee.lastName,
            positionTitle: evaluatorEmployee.positionTitle,
            orgUnit: evaluatorEmployee.orgUnit,
          };
    return {
      view,
      regulation,
      officeName: officeName ?? '',
      evaluator,
      accountNames,
      history,
      sheetVersions,
    };
  };
}
