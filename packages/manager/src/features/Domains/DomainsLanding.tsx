import { Domain, getDomains } from '@linode/api-v4/lib/domains';
import { APIError } from '@linode/api-v4/lib/types';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import { equals, pathOr } from 'ramda';
import * as React from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { Link, RouteComponentProps } from 'react-router-dom';
import { compose } from 'recompose';
import DomainIcon from 'src/assets/addnewmenu/domain.svg';
import ActionsPanel from 'src/components/ActionsPanel';
import AddNewLink from 'src/components/AddNewLink';
import Breadcrumb from 'src/components/Breadcrumb';
import Button from 'src/components/Button';
import CircleProgress from 'src/components/CircleProgress';
import ConfirmationDialog from 'src/components/ConfirmationDialog';
import FormControlLabel from 'src/components/core/FormControlLabel';
import Hidden from 'src/components/core/Hidden';
import {
  createStyles,
  Theme,
  withStyles,
  WithStyles
} from 'src/components/core/styles';
import Typography from 'src/components/core/Typography';
import setDocs from 'src/components/DocsSidebar/setDocs';
import { DocumentTitleSegment } from 'src/components/DocumentTitle';
import EntityTable, {
  EntityTableRow,
  HeaderCell
} from 'src/components/EntityTable';
import EntityTable_CMR from 'src/components/EntityTable/EntityTable_CMR';
import ErrorState from 'src/components/ErrorState';
import Grid from 'src/components/Grid';
import LandingHeader from 'src/components/LandingHeader';
import Notice from 'src/components/Notice';
import { Order } from 'src/components/Pagey';
import Placeholder from 'src/components/Placeholder';
import PreferenceToggle, { ToggleProps } from 'src/components/PreferenceToggle';
import Toggle from 'src/components/Toggle';
import domainsContainer, {
  Props as DomainProps
} from 'src/containers/domains.container';
import withFeatureFlags, {
  FeatureFlagConsumerProps
} from 'src/containers/withFeatureFlagConsumer.container.ts';
import { Domains } from 'src/documentation';
import { ApplicationState } from 'src/store';
import {
  openForCloning,
  openForCreating,
  openForEditing as _openForEditing,
  Origin as DomainDrawerOrigin
} from 'src/store/domainDrawer';
import { upsertMultipleDomains } from 'src/store/domains/domains.actions';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import { sendGroupByTagEnabledEvent } from 'src/utilities/ga';
import DisableDomainDialog from './DisableDomainDialog';
import { Handlers as DomainHandlers } from './DomainActionMenu';
import DomainRow from './DomainTableRow';
import DomainRow_CMR from './DomainTableRow_CMR';
import DomainZoneImportDrawer from './DomainZoneImportDrawer';

type ClassNames =
  | 'root'
  | 'titleWrapper'
  | 'title'
  | 'breadcrumbs'
  | 'domain'
  | 'dnsWarning'
  | 'tagWrapper'
  | 'tagGroup'
  | 'importButton';

const styles = (theme: Theme) =>
  createStyles({
    titleWrapper: {
      flex: 1
    },
    title: {
      marginBottom: theme.spacing(1) + theme.spacing(1) / 2
    },
    breadcrumbs: {
      marginBottom: theme.spacing(1)
    },
    domain: {
      width: '60%'
    },
    dnsWarning: {
      '& h3:first-child': {
        marginBottom: theme.spacing(1)
      }
    },
    tagWrapper: {
      marginTop: theme.spacing(1) / 2,
      '& [class*="MuiChip"]': {
        cursor: 'pointer'
      }
    },
    tagGroup: {
      flexDirection: 'row-reverse',
      marginBottom: theme.spacing(2) - 8
    },
    importButton: {
      paddingTop: 5,
      paddingBottom: 5
    }
  });

interface State {
  importDrawerOpen: boolean;
  importDrawerSubmitting: false;
  importDrawerErrors?: APIError[];
  remote_nameserver: string;
  createDrawerOpen: boolean;
  createDrawerMode: 'clone' | 'create';
  selectedDomainLabel: string;
  selectedDomainID?: number;
  removeDialogOpen: boolean;
  disableDialogOpen: boolean;
}

interface Props {
  /** purely so we can force a preference to get the unit tests to pass */
  shouldGroupDomains?: boolean;
  // Since Slave Domains do not have a Detail page, we allow the consumer to
  // render this component with the "Edit Domain" drawer already opened.
  domainForEditing?: {
    domainId: number;
    domainLabel: string;
  };
}

const initialOrder = { order: 'asc' as Order, orderBy: 'domain' };

export type CombinedProps = DomainProps &
  WithStyles<ClassNames> &
  Props &
  RouteComponentProps<{}> &
  StateProps &
  DispatchProps &
  WithSnackbarProps &
  FeatureFlagConsumerProps;

const headers: HeaderCell[] = [
  {
    label: 'Domain',
    dataColumn: 'domain',
    sortable: true,
    widthPercent: 25
  },
  {
    label: 'Status',
    dataColumn: 'status',
    sortable: true,
    widthPercent: 10
  },
  {
    label: 'Type',
    dataColumn: 'type',
    sortable: true,
    widthPercent: 10,
    hideOnMobile: true
  },
  {
    label: 'Last Modified',
    dataColumn: 'updated',
    sortable: true,
    widthPercent: 20,
    hideOnMobile: true
  },
  {
    label: 'Action Menu',
    visuallyHidden: true,
    dataColumn: '',
    sortable: false,
    widthPercent: 5
  }
];

export class DomainsLanding extends React.Component<CombinedProps, State> {
  state: State = {
    importDrawerOpen: false,
    importDrawerSubmitting: false,
    importDrawerErrors: undefined,
    remote_nameserver: '',
    createDrawerMode: 'create',
    createDrawerOpen: false,
    removeDialogOpen: false,
    selectedDomainLabel: '',
    disableDialogOpen: false
  };

  static docs: Linode.Doc[] = [Domains];

  componentDidMount = () => {
    const {
      domainForEditing,
      domainsLastUpdated,
      isLargeAccount,
      openForEditing,
      getAllDomains
    } = this.props;
    // Open the "Edit Domain" drawer if so specified by this component's props.
    if (domainForEditing) {
      const { domainId, domainLabel } = domainForEditing;
      openForEditing(domainLabel, domainId);
    }

    if (!isLargeAccount && domainsLastUpdated === 0) {
      getAllDomains();
    }
  };

  componentDidUpdate = (prevProps: CombinedProps) => {
    // Open the "Edit Domain" drawer if so specified by this component's props.
    const { domainForEditing } = this.props;
    if (
      !equals(prevProps.domainForEditing, domainForEditing) &&
      domainForEditing
    ) {
      this.props.openForEditing(
        domainForEditing.domainLabel,
        domainForEditing.domainId
      );
    }
  };

  cancelRequest: Function;

  openImportZoneDrawer = () => this.setState({ importDrawerOpen: true });

  closeImportZoneDrawer = () =>
    this.setState({
      importDrawerOpen: false,
      importDrawerSubmitting: false,
      remote_nameserver: '',
      selectedDomainLabel: '',
      importDrawerErrors: undefined
    });

  handleSuccess = (domain: Domain) => {
    this.props.upsertDomain(domain);

    if (domain.id) {
      return this.props.history.push(`/domains/${domain.id}`);
    }
  };

  getActions = () => {
    return (
      <ActionsPanel>
        <Button
          buttonType="cancel"
          onClick={this.closeRemoveDialog}
          data-qa-cancel
        >
          Cancel
        </Button>
        <Button
          buttonType="secondary"
          destructive
          onClick={this.removeDomain}
          data-qa-submit
        >
          Confirm
        </Button>
      </ActionsPanel>
    );
  };

  removeDomain = () => {
    const { selectedDomainID } = this.state;
    const { enqueueSnackbar, deleteDomain } = this.props;
    if (selectedDomainID) {
      deleteDomain({ domainId: selectedDomainID })
        .then(() => {
          this.closeRemoveDialog();
        })
        .catch(() => {
          this.closeRemoveDialog();
          /** @todo render this error inside the modal */
          enqueueSnackbar('Error when removing domain', {
            variant: 'error'
          });
        });
    } else {
      this.closeRemoveDialog();
      enqueueSnackbar('Error when removing domain', {
        variant: 'error'
      });
    }
  };

  handleClickEnableOrDisableDomain = (
    action: 'enable' | 'disable',
    domain: string,
    domainId: number
  ) => {
    if (action === 'enable') {
      return this.props
        .updateDomain({
          domainId,
          status: 'active'
        })
        .catch(e => {
          return this.props.enqueueSnackbar(
            getAPIErrorOrDefault(
              e,
              'There was an issue enabling your domain'
            )[0].reason,
            {
              variant: 'error'
            }
          );
        });
    } else {
      return this.setState({
        disableDialogOpen: true,
        selectedDomainID: domainId,
        selectedDomainLabel: domain
      });
    }
  };

  openRemoveDialog = (domain: string, domainId: number) => {
    this.setState({
      removeDialogOpen: true,
      selectedDomainLabel: domain,
      selectedDomainID: domainId
    });
  };

  closeRemoveDialog = () => {
    this.setState({
      removeDialogOpen: false
    });
  };

  openCreateDomainDrawer = () => {
    this.props.openForCreating('Created from Domain Landing');
  };

  render() {
    const { classes } = this.props;
    const {
      domainsError,
      domainsData,
      domainsLoading,
      domainsLastUpdated,
      flags,
      howManyLinodesOnAccount,
      isLargeAccount,
      isRestrictedUser,
      linodesLoading
    } = this.props;

    const Table = flags.cmr ? EntityTable_CMR : EntityTable;

    const handlers: DomainHandlers = {
      onClone: this.props.openForCloning,
      onEdit: this.props.openForEditing,
      onRemove: this.openRemoveDialog,
      onDisableOrEnable: this.handleClickEnableOrDisableDomain
    };

    const domainRow: EntityTableRow<Domain> = {
      Component: flags.cmr ? DomainRow_CMR : DomainRow,
      data: domainsData ?? [],
      request: isLargeAccount ? getDomains : undefined,
      handlers,
      loading: domainsLoading,
      error: domainsError.read,
      lastUpdated: domainsLastUpdated
    };

    if (domainsLoading) {
      return <RenderLoading />;
    }

    if (domainsError.read) {
      return <RenderError />;
    }

    if (!isLargeAccount && domainsData?.length === 0) {
      /**
       * We don't know whether or not a large account is empty or not
       * until Pagey has made its first request, and putting this
       * empty state inside of Pagey would be weird/difficult.
       *
       * The other option is to make an initial request when this
       * component mounts, which Pagey would ignore.
       *
       * I think a slightly different empty state for large accounts is
       * the best trade-off until we have the thing-count endpoint,
       * but open to persuasion on this.
       */
      return (
        <React.Fragment>
          <RenderEmpty
            onCreateDomain={this.openCreateDomainDrawer}
            onImportZone={this.openImportZoneDrawer}
          />
          <DomainZoneImportDrawer
            open={this.state.importDrawerOpen}
            onClose={this.closeImportZoneDrawer}
            onSuccess={this.handleSuccess}
          />
        </React.Fragment>
      );
    }

    /**
     * Users with no Linodes on their account should see a banner
     * warning them that their DNS records are not being served.
     *
     * Restricted users can often not view the number of Linodes
     * on the account, so to prevent the possibility of displaying inaccurate
     * warnings, we don't show the banner to restricted users.
     *
     * We also hide the banner while Linodes data are still loading, since count
     * will be 0 until loading is complete.
     */
    const shouldShowBanner =
      !isRestrictedUser &&
      !linodesLoading &&
      howManyLinodesOnAccount === 0 &&
      domainsData &&
      domainsData.length > 0;

    return (
      <React.Fragment>
        <DocumentTitleSegment segment="Domains" />
        {shouldShowBanner && (
          <Notice warning important className={classes.dnsWarning}>
            <Typography variant="h3">
              Your DNS zones are not being served.
            </Typography>
            <Typography>
              Your domains will not be served by Linode&#39;s nameservers unless
              you have at least one active Linode on your account.
              <Link to="/linodes/create"> You can create one here.</Link>
            </Typography>
          </Notice>
        )}
        {this.props.location.state?.recordError && (
          <Notice error text={this.props.location.state.recordError} />
        )}
        <PreferenceToggle<boolean>
          preferenceKey="domains_group_by_tag"
          preferenceOptions={[false, true]}
          localStorageKey="GROUP_DOMAINS"
          toggleCallbackFnDebounced={toggleDomainsGroupBy}
          /** again, this value prop should be undefined - purely for the unit test's sake */
          value={this.props.shouldGroupDomains}
        >
          {({
            preference: domainsAreGrouped,
            togglePreference: toggleGroupDomains
          }: ToggleProps<boolean>) => {
            return (
              <React.Fragment>
                {flags.cmr ? (
                  <LandingHeader
                    title="Domains"
                    body={
                      <Hidden mdUp>
                        <Button
                          className={classes.importButton}
                          onClick={this.openImportZoneDrawer}
                        >
                          Import a Zone
                        </Button>
                      </Hidden>
                    }
                    extraActions={
                      <Button onClick={this.openImportZoneDrawer}>
                        Import a Zone
                      </Button>
                    }
                    entity="Domain"
                    onAddNew={this.openCreateDomainDrawer}
                    iconType="domain"
                    docsLink="https://www.linode.com/docs/platform/manager/dns-manager/"
                  />
                ) : (
                  <Grid
                    container
                    justify="space-between"
                    alignItems="flex-end"
                    style={{ paddingBottom: 0 }}
                  >
                    <Grid item className={classes.titleWrapper}>
                      <Breadcrumb
                        // This component can be rendered with the URL
                        // /domains/:domainId, which would result in a double
                        // breadcrumb. Thus we give the <Breadcrumb /> an explicit
                        // pathname.
                        pathname="Domains"
                        labelTitle="Domains"
                        className={classes.breadcrumbs}
                      />
                    </Grid>
                    <Grid item className="p0">
                      <FormControlLabel
                        className={classes.tagGroup}
                        control={
                          <Toggle
                            className={
                              domainsAreGrouped ? ' checked' : ' unchecked'
                            }
                            onChange={toggleGroupDomains}
                            checked={domainsAreGrouped}
                            disabled={isLargeAccount}
                          />
                        }
                        label="Group by Tag:"
                      />
                    </Grid>
                    <Grid item>
                      <Grid
                        container
                        alignItems="flex-end"
                        style={{ width: 'auto' }}
                      >
                        <Grid item className="pt0">
                          <AddNewLink
                            onClick={this.openImportZoneDrawer}
                            label="Import a Zone"
                          />
                        </Grid>
                        <Grid item className="pt0">
                          <AddNewLink
                            data-testid="create-domain"
                            onClick={this.openCreateDomainDrawer}
                            label="Add a Domain"
                          />
                        </Grid>
                      </Grid>
                    </Grid>
                  </Grid>
                )}
                <Table
                  entity="domain"
                  groupByTag={domainsAreGrouped}
                  row={domainRow}
                  headers={headers}
                  initialOrder={initialOrder}
                  normalizeData={(pageyData: Domain[]) => {
                    // Use Redux copies of each Domain, since Redux is more up-to-date.
                    return getReduxCopyOfDomains(
                      pageyData,
                      this.props.domainsByID
                    );
                  }}
                  // Persist Pagey data to Redux.
                  persistData={(data: Domain[]) => {
                    this.props.upsertMultipleDomains(data);
                  }}
                />
              </React.Fragment>
            );
          }}
        </PreferenceToggle>
        <DomainZoneImportDrawer
          open={this.state.importDrawerOpen}
          onClose={this.closeImportZoneDrawer}
          onSuccess={this.handleSuccess}
        />
        <DisableDomainDialog
          updateDomain={this.props.updateDomain}
          selectedDomainID={this.state.selectedDomainID}
          selectedDomainLabel={this.state.selectedDomainLabel}
          closeDialog={() => this.setState({ disableDialogOpen: false })}
          open={this.state.disableDialogOpen}
        />
        <ConfirmationDialog
          open={this.state.removeDialogOpen}
          title={`Remove ${this.state.selectedDomainLabel}`}
          onClose={this.closeRemoveDialog}
          actions={this.getActions}
        >
          <Typography>Are you sure you want to remove this domain?</Typography>
        </ConfirmationDialog>
      </React.Fragment>
    );
  }
}

const RenderLoading: React.FC<{}> = () => {
  return <CircleProgress />;
};

const RenderError: React.FC<{}> = () => {
  return (
    <ErrorState errorText="There was an error retrieving your domains. Please reload and try again." />
  );
};

const EmptyCopy = () => (
  <>
    <Typography variant="subtitle1">
      Create a Domain, add Domain records, import zones and domains.
    </Typography>
    <Typography variant="subtitle1">
      <a
        href="https://www.linode.com/docs/platform/manager/dns-manager-new-manager/"
        target="_blank"
        aria-describedby="external-site"
        rel="noopener noreferrer"
        className="h-u"
      >
        Find out how to setup your domains associated with your Linodes
      </a>
      &nbsp;or&nbsp;
      <a
        href="https://www.linode.com/docs/"
        target="_blank"
        aria-describedby="external-site"
        rel="noopener noreferrer"
        className="h-u"
      >
        visit our guides and tutorials.
      </a>
    </Typography>
  </>
);

const RenderEmpty: React.FC<{
  onCreateDomain: () => void;
  onImportZone: () => void;
}> = props => {
  return (
    <React.Fragment>
      <DocumentTitleSegment segment="Domains" />
      <Placeholder
        title="Manage your Domains"
        copy={<EmptyCopy />}
        icon={DomainIcon}
        buttonProps={[
          {
            onClick: props.onCreateDomain,
            children: 'Add a Domain'
          },
          {
            onClick: props.onImportZone,
            children: 'Import a Zone'
          }
        ]}
      />
    </React.Fragment>
  );
};

const eventCategory = `domains landing`;

const toggleDomainsGroupBy = (checked: boolean) =>
  sendGroupByTagEnabledEvent(eventCategory, checked);

const styled = withStyles(styles);

interface DispatchProps {
  openForCloning: (domain: string, id: number) => void;
  openForEditing: (domain: string, id: number) => void;
  openForCreating: (origin: DomainDrawerOrigin) => void;
  upsertMultipleDomains: (domains: Domain[]) => void;
}

interface StateProps {
  howManyLinodesOnAccount: number;
  linodesLoading: boolean;
  isRestrictedUser: boolean;
  isLargeAccount: boolean;
  domainsByID: Record<string, Domain>;
}

const mapStateToProps: MapStateToProps<
  StateProps,
  {},
  ApplicationState
> = state => ({
  howManyLinodesOnAccount: state.__resources.linodes.results,
  linodesLoading: pathOr(false, ['linodes', 'loading'], state.__resources),
  isRestrictedUser: pathOr(
    true,
    ['__resources', 'profile', 'data', 'restricted'],
    state
  ),
  isLargeAccount: state.__resources.accountManagement.isLargeAccount,
  domainsByID: state.__resources.domains.itemsById
});

export const connected = connect(mapStateToProps, {
  openForCreating,
  openForCloning,
  openForEditing: _openForEditing,
  upsertMultipleDomains
});

export default compose<CombinedProps, Props>(
  setDocs(DomainsLanding.docs),
  domainsContainer(),
  connected,
  withSnackbar,
  withFeatureFlags,
  styled
)(DomainsLanding);

// Given a list of "baseDomains" (requested from the API via Pagey) and a record of Domains
// from Redux, return the Redux copy of each base Domain. This is useful because the Redux
// copy of the Domain may have updates the original data from Pagey doesn't.
export const getReduxCopyOfDomains = (
  baseDomains: Domain[],
  reduxDomains: Record<string, Domain>
) => {
  return baseDomains.reduce((acc, thisDomain) => {
    const thisReduxDomain = reduxDomains[thisDomain.id];
    if (thisReduxDomain) {
      return [...acc, thisReduxDomain];
    }
    return acc;
  }, []);
};
