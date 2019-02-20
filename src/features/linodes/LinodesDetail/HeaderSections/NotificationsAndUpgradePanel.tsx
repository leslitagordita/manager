import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  StyleRulesCallback,
  withStyles,
  WithStyles
} from 'src/components/core/styles';
import Notice from 'src/components/Notice';
import ProductNotification from 'src/components/ProductNotification';
import MigrationNotification from './MigrationNotification';

type ClassNames = 'root' | 'link';

const styles: StyleRulesCallback<ClassNames> = theme => ({
  root: {},
  link: {
    color: theme.palette.primary.main,
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline'
    }
  }
});

interface Props {
  handleUpgrade: () => void;
  handleMigration: (type: string) => void;
  showPendingMutation: boolean;
  status: Linode.LinodeStatus;
  notifications?: Linode.Notification[];
  linodeId: number;
}

type CombinedProps = Props & WithStyles<ClassNames>;

const NotificationsAndUpgradePanel = (props: CombinedProps) => {
  return (
    <React.Fragment>
      {props.showPendingMutation && (
        <Notice important warning>
          This Linode has pending&nbsp;
          <Link to={`/linodes/${props.linodeId}/resize`}>
            upgrades available
          </Link>
          . To learn more about this upgrade and what it includes,&nbsp;
          {/** @todo change onClick to open mutate drawer once migrate exists */}
          <span
            role="button"
            className={props.classes.link}
            onClick={props.handleUpgrade}
          >
            click here.
          </span>
        </Notice>
      )}
      {(props.notifications || []).map((n, idx) =>
        ['migration_scheduled', 'migration_pending'].includes(n.type) ? (
          props.status !== 'migrating' && (
            <MigrationNotification
              key={idx}
              text={n.message}
              type={n.type}
              onClick={props.handleMigration}
            />
          )
        ) : (
          <ProductNotification
            key={idx}
            severity={n.severity}
            text={n.message}
          />
        )
      )}
    </React.Fragment>
  );
};

const styled = withStyles(styles);

export default styled(NotificationsAndUpgradePanel);
