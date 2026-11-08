import {Module} from '@nestjs/common';
import {DatabaseModule} from './modules/database/database.module';
import {AuthService} from './modules/garden-site/auth.service';
import {GardenService} from './modules/garden-site/garden.service';
import {SiteController} from './modules/garden-site/site.controller';
@Module({imports:[DatabaseModule],providers:[AuthService,GardenService],controllers:[SiteController]})
export class GardenSiteModule {}
