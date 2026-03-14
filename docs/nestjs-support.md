# NestJS Support

Daemon supporte les projets NestJS avec templates complets et analyseur dédié.

## Patterns Testés

### Controllers

```typescript
// Controller avec routes, guards, pipes
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

### Services

```typescript
// Service avec Dependency Injection et error handling
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly logger: Logger,
  ) {}

  async findAll(query: PaginationDto): Promise<PaginatedResult<User>> {
    const [users, total] = await this.usersRepository.findAndCount({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return { data: users, total, page: query.page, limit: query.limit };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    return user;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const user = this.usersRepository.create(createUserDto);
      return await this.usersRepository.save(user);
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }
}
```

### Guards

```typescript
// Guard d'authentification
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler()
    );

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }
}
```

### Pipes

```typescript
// Pipe de validation personnalisé
@Injectable()
export class CustomValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      throw new BadRequestException('Validation failed');
    }

    return value;
  }
}

// Pipe de transformation
@Injectable()
export class ParseIntArrayPipe implements PipeTransform<string, number[]> {
  transform(value: string): number[] {
    if (!value) return [];

    const numbers = value.split(',').map((v) => parseInt(v, 10));

    if (numbers.some(isNaN)) {
      throw new BadRequestException('Invalid array format');
    }

    return numbers;
  }
}
```

### Interceptors

```typescript
// Interceptor de logging
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(`${method} ${url} - ${Date.now() - now}ms`),
        error: (error) =>
          this.logger.error(
            `${method} ${url} - ${Date.now() - now}ms - ${error.message}`
          ),
      })
    );
  }
}

// Interceptor de transformation de réponse
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        statusCode: context.switchToHttp().getResponse().statusCode,
        timestamp: new Date().toISOString(),
      }))
    );
  }
}
```

## Templates Disponibles

### Unit Tests

| Template | Description | Fichier |
|----------|-------------|---------|
| **Controller** | Tests de contrôleurs | `controller.spec.ts` |
| **Service** | Tests de services | `service.spec.ts` |
| **Module** | Tests de modules | `module.spec.ts` |
| **Guard** | Tests de guards | `guard.spec.ts` |
| **Interceptor** | Tests d'intercepteurs | `interceptor.spec.ts` |
| **Pipe** | Tests de pipes | `pipe.spec.ts` |

### E2E Tests

| Template | Description | Fichier |
|----------|-------------|---------|
| **API** | Tests CRUD API | `e2e/api.e2e-spec.ts` |
| **Auth** | Tests authentification | `e2e/auth.e2e-spec.ts` |

### Fixtures

| Template | Description | Fichier |
|----------|-------------|---------|
| **Test Module** | Helpers de test | `fixtures/test-module.ts` |

## Meilleures Pratiques

### 1. Structure de Module

```
users/
├── dto/
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   └── pagination.dto.ts
├── entities/
│   └── user.entity.ts
├── users.controller.ts
├── users.controller.spec.ts
├── users.service.ts
├── users.service.spec.ts
├── users.module.ts
└── users.module.spec.ts
```

### 2. DTOs avec Validation

```typescript
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsOptional()
  name?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

### 3. Error Handling

```typescript
// Exception personnalisée
export class UserNotFoundException extends NotFoundException {
  constructor(id: number) {
    super(`User with ID ${id} not found`);
  }
}

// Utilisation dans le service
async findOne(id: number): Promise<User> {
  const user = await this.repository.findOne({ where: { id } });
  if (!user) {
    throw new UserNotFoundException(id);
  }
  return user;
}
```

### 4. Pagination

```typescript
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

// Dans le service
async findAll(dto: PaginationDto): Promise<PaginatedResult<User>> {
  const [data, total] = await this.repository.findAndCount({
    skip: (dto.page - 1) * dto.limit,
    take: dto.limit,
  });

  return { data, total, page: dto.page, limit: dto.limit };
}
```

### 5. Test Module Builder

```typescript
// Utiliser le test module builder
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [UsersController],
    providers: [
      UsersService,
      {
        provide: getRepositoryToken(User),
        useValue: mockRepository,
      },
    ],
  })
    .overrideProvider(JwtService)
    .useValue(mockJwtService)
    .compile();

  controller = module.get<UsersController>(UsersController);
  service = module.get<UsersService>(UsersService);
});
```

## Analyseur NestJS

L'analyseur Daemon vérifie :

### Dependency Injection

- ✅ Imports circulaires entre modules
- ✅ Providers exportés correctement
- ✅ Décorateurs @Injectable présents
- ✅ Injection via constructeur

### Décorateurs

- ✅ @Controller sur les contrôleurs
- ✅ @Injectable sur les services/guards/pipes
- ✅ @UseGuards sur les routes protégées
- ✅ @UsePipes pour la validation
- ✅ @UseInterceptors pour le logging

### Patterns

- ✅ Single Responsibility (max 5 dépendances)
- ✅ Contrôleurs avec routes
- ✅ Services avec logique métier
- ✅ Guards avec canActivate()
- ✅ Pipes avec transform()
- ✅ Interceptors avec intercept()

## Commandes

### Review NestJS

```bash
# Review complet avec analyse NestJS
npx @oalacea/daemon review --analyzers nestjs

# Output exemple
📊 NestJS Analysis

Modules:        12 ✓
Controllers:    18 ✓
Services:       24 ✓
Guards:         6 ✓
Pipes:          8 ✓
Interceptors:   4 ✓

Issues Found:
  🔴 Circular: AuthModule ←→ UserModule
  🟡 Too many deps: DataService (7 deps)
  🟡 No auth: PublicController.post()
  🟢 Missing DTO: 3 endpoints

Score: 78/100
```

### Tests NestJS

```bash
# Lancer les tests
docker exec daemon-tools npm test

# Tests e2e
docker exec daemon-tools npm run test:e2e

# Tests avec coverage
docker exec daemon-tools npm run test:cov
```

## Configuration

```javascript
// daemon.config.js
export default {
  nestjs: {
    // Analyser les modules
    analyzeModules: true,

    // Vérifier les dépendances
    checkCircularDeps: true,

    // Vérifier Single Responsibility
    checkSingleResponsibility: true,

    // Vérifier l'error handling
    checkErrorHandling: true,

    // Vérifier les DTOs
    checkDTOs: true,

    // Limite de dépendances
    maxDependencies: 5,

    // Templates personnalisés
    templates: {
      controller: './templates/nestjs/controller.spec.ts',
      service: './templates/nestjs/service.spec.ts',
      module: './templates/nestjs/module.spec.ts',
      guard: './templates/nestjs/guard.spec.ts',
      interceptor: './templates/nestjs/interceptor.spec.ts',
      pipe: './templates/nestjs/pipe.spec.ts',
      e2e: {
        api: './templates/nestjs/e2e/api.e2e-spec.ts',
        auth: './templates/nestjs/e2e/auth.e2e-spec.ts',
      },
    },
  },
};
```

## CI/CD

### GitHub Actions

```yaml
name: NestJS Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:cov

      - name: Run e2e tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Ressources

- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS CLI](https://docs.nestjs.com/cli/usages)
- [Testing with NestJS](https://docs.nestjs.com/fundamentals/testing)
- [Dependency Injection](https://docs.nestjs.com/providers)
- [Guards](https://docs.nestjs.com/guards)
- [Interceptors](https://docs.nestjs.com/interceptors)
- [Pipes](https://docs.nestjs.com/pipes)
