> Tradução para português de [project/git/README.md](../../project/git/README.md).

> Redescobrindo o Git: abrace o começo
>   Isto deve te ajudar a ir um passo além no uso do Git  ^*^


* [Instalar o Git](#instalar-o-git)
* [Arquivos de configuração](#arquivos-de-configuração)
    * [Ver a config](#ver-a-config)
    * [Definir as informações do usuário](#definir-as-informações-do-usuário)
    * [Aliases do Git](#aliases-do-git)
    * [O arquivo .gitignore](#o-arquivo-gitignore)
* [Operações básicas do repositório](#operações-básicas-do-repositório)
    * [Inicializar o repositório](#inicializar-o-repositório)
    * [Adicionar arquivos à área de stage](#adicionar-arquivos-à-área-de-stage)
    * [status do repositório](#status-do-repositório)
    * [diff do repositório](#diff-do-repositório)
    * [Confirmar as alterações (commit)](#confirmar-as-alterações-commit)
    * [Remover arquivos](#remover-arquivos)
    * [Mover arquivos](#mover-arquivos)
    * [Ver o histórico de commits](#ver-o-histórico-de-commits)
    * [Desfazer operações](#desfazer-operações)
    * [Tags](#tags)
* [Operações com branches](#operações-com-branches)
    * [Criar branches](#criar-branches)
    * [Trocar de branch](#trocar-de-branch)
    * [Mesclar branches](#mesclar-branches)
    * [Excluir branches](#excluir-branches)
    * [Gerenciar branches](#gerenciar-branches)
    * [Rebase](#rebase)
    * [Branches remotos](#branches-remotos)
    * [Branches de rastreamento](#branches-de-rastreamento)
* [Operações com repositórios remotos](#operações-com-repositórios-remotos)
    * [Clonar um repositório](#clonar-um-repositório)
    * [Ver os repositórios remotos](#ver-os-repositórios-remotos)
    * [Adicionar um repositório remoto](#adicionar-um-repositório-remoto)
    * [Pull e push com repositórios remotos](#pull-e-push-com-repositórios-remotos)
    * [Remover e renomear repositórios remotos](#remover-e-renomear-repositórios-remotos)



<span id = "instalar-o-git"></span>
## Instalar o Git

**Linux**

`$ sudo yum install git`

ou

`$ sudo apt-get install git`

**Mac**

Execute o comando `git` diretamente no `Terminal`; se ele não estiver instalado, será exibida uma indicação de como instalá-lo.

Se preferir um instalador, [clique aqui](http://git-scm.com/download/mac)
<span id = "arquivos-de-configuração"></span>
## Arquivos de configuração

Na primeira instalação, não se esqueça de jeito nenhum de configurar o nome e o e-mail de quem usa o git. O motivo é simples: cada commit precisa registrar quem o fez. Se não houver autor, quando aparecer um bug, quem vai levar a culpa??

<span id = "ver-a-config"></span>
### Ver a config

O Git vem com uma ferramenta chamada git config, que ajuda a definir as variáveis de configuração que controlam a aparência e o comportamento do Git.

**Arquivo `/etc/gitconfig`: contém a configuração geral de todos os usuários do sistema e de seus repositórios.**

`$ git config --system --list`

---

**Arquivo `~/.gitconfig` ou `~/.config/git/config`: vale apenas para o usuário atual.**

`$ git config --global --list`

---


O arquivo config dentro do diretório Git do repositório em uso (ou seja, `.git/config`): vale para esse repositório.

Cada nível sobrescreve a configuração do nível anterior, então as variáveis de `.git/config` sobrescrevem as de `/etc/gitconfig`.

---

**Claro, também é possível consultar um item de configuração específico.**

* Forma: `git config [--global|--system] <key>`

*Ver o valor final (efetivo) da propriedade*
`$ git config user.name`  

*Ver o valor da propriedade no nível global (do usuário atual)*
`$ git config --global user.name`   


---
<span id = "definir-as-informações-do-usuário"></span>
### Definir as informações do usuário

`$ git config --global user.name "name"`

`$ git config --global user.email xxx@163.com`

Com a opção `--global`, qualquer operação feita depois neste sistema usará essa propriedade. Se você precisar usar outro nome e e-mail em um projeto específico, pode configurar o **arquivo config do projeto**; assim as propriedades desse config sobrescrevem as **propriedades globais (global)**, sem afetar os outros projetos. Para isso, basta omitir o parâmetro `--global`, e o arquivo `.git/config` do projeto será alterado.

`$ git config user.name "name"`


---

**Obter o manual de ajuda**

Forma: `git help <verb>` ou `git <verb> --help`

Por exemplo, para ver o manual do config:

`$ git help config`
<span id = "aliases-do-git"></span>
### Aliases do Git

Exemplo: depois de criar os aliases, você pode usar a forma abreviada daqui em diante

```
$ git config --global alias.br branch
$ git config --global alias.ci commit
$ git config --global alias.st status
```

<span id = "o-arquivo-gitignore"></span>
### O arquivo .gitignore

Para arquivos gerados automaticamente, logs, arquivos temporários de compilação etc., é possível configurar o git para não rastreá-los.

As regras são as seguintes:

* Todas as linhas em branco ou que começam com # são ignoradas pelo Git.
* É possível usar padrões glob padrão.
* Um padrão pode começar com (/) para evitar a recursão.
* Um padrão pode terminar com (/) para indicar um diretório.
* Para ignorar arquivos ou diretórios fora de um padrão específico, você pode negar o padrão colocando um ponto de exclamação (!) na frente.

`Padrões glob` são expressões regulares simplificadas usadas pelo shell.

* `*` : corresponde a zero ou mais caracteres quaisquer
* `[abc]` : corresponde a apenas um dos caracteres entre colchetes
* `[0-9]` : usa o hífen para indicar um intervalo; corresponde a qualquer caractere entre 0 e 9.
* `?` : corresponde a exatamente um caractere qualquer
* `**`: corresponde a qualquer quantidade de diretórios intermediários; por exemplo, `a/**/z` corresponde a `a/z`, `a/b/z`, `a/b/c/z` etc.

Segue um modelo:


```
# Ignora todos os arquivos terminados em .c
*.c

# Mas stream.c será rastreado pelo git
!stream.c

# Ignora apenas o arquivo TODO da pasta atual, não o TODO de outras pastas, por exemplo: subdir/TODO
/TODO

# Ignora todos os arquivos dentro da pasta build
build/

# Ignora doc/notes.txt, mas não os .txt em níveis mais profundos, por exemplo: doc/server/arch.txt
doc/*.txt

# Ignora todos os arquivos .pdf dentro do diretório doc
doc/**/*.pdf
```

<span id = "operações-básicas-do-repositório"></span>
## Operações básicas do repositório

<span id = "inicializar-o-repositório"></span>
### Inicializar o repositório


```
$ git init
```



<span id = "adicionar-arquivos-à-área-de-stage"></span>
### Adicionar arquivos à área de stage


```
# Adiciona todos os arquivos terminados em `.c` que não existem na área de stage e no histórico ou que foram alterados
$ git add *.c

# Adiciona todos os arquivos que não existem na área de stage e no histórico ou que foram alterados
$ git add .  

# Adiciona um arquivo específico
$ git add test.c
```



---

<span id = "status-do-repositório"></span>
### status do repositório



```
$ git status

# Para exibir em formato compacto
$ git status --short      # equivale a $ git status -s
```

No formato compacto, as letras significam o seguinte:

* `??` : arquivo novo, ainda não rastreado
* ` M` : M à direita, indica que o arquivo foi modificado, mas ainda não foi para a área de stage
* `M ` : M à esquerda, indica que o arquivo foi modificado e já foi para a área de stage
* `MM` : aparecem dois, indicando que o arquivo foi modificado no diretório de trabalho e colocado na área de stage, mas depois foi modificado de novo e essa nova alteração não foi adicionada à área de stage


---



<span id = "diff-do-repositório"></span>
### diff do repositório

Se você quer saber exatamente o que mudou em um arquivo, o `diff` é muito útil


```
# Mostra quais partes dos arquivos rastreados, mas ainda não preparados (stage), foram alteradas; sem parâmetros extras
$ git diff

# Para o conteúdo já adicionado à área de stage com add, use o parâmetro --staged ou --cached
$ git diff --staged

```

<span id = "confirmar-as-alterações-commit"></span>
### Confirmar as alterações (commit)


```
# Forma comum
$ git commit -m "commit message"

# Se você não usar o parâmetro -m para informar a mensagem, o git abre o editor padrão, como o vi, para escrever a descrição do commit.
# Você pode definir seu editor preferido com $ git config --global core.editor
 
# Pula a área de stage e faz o commit direto do diretório de trabalho para o histórico (vale apenas para arquivos já rastreados)
$ git commit -a -m ""          # equivale a: $ git commit -am ""



```

<span id = "remover-arquivos"></span>
### Remover arquivos

Se você excluir um arquivo no diretório de trabalho, precisa primeiro fazer `add` para depois poder fazer o commit. Com `git rm`, o arquivo é excluído diretamente do diretório de trabalho e a remoção já é registrada na área de stage.


```
$ git rm fileName

# Se o arquivo foi modificado e adicionado à área de stage, é preciso usar o parâmetro -f para forçar a remoção (force)
$ git rm -f fileName

# É possível usar padrões glob, como abaixo
$ git rm log/\*.log         # remove todos os arquivos terminados em .log no diretório log
$ git rm \*~                # remove todos os arquivos terminados em ~
```

<span id = "mover-arquivos"></span>
### Mover arquivos

Da mesma forma, usar `git mv` é muito mais prático, e o mesmo vale se você quiser renomear um arquivo


```
$ git mv file_from file_to
```
Depois de executar esse comando, basta fazer o próximo `commit`, sem se preocupar com operações adicionais. Equivale ao seguinte:

```
$ mv file_from file_to
$ git rm file_from
$ git add file_to

```

<span id = "ver-o-histórico-de-commits"></span>
### Ver o histórico de commits

O `git log` mais básico lista todas as alterações por ordem de data do commit, incluindo o checksum SHA-1 do commit, o nome e o e-mail do autor, a data e a mensagem do commit. Vejamos as opções mais usadas.


```
# -p: mostra as diferenças (patch) de cada commit; -x limita aos x commits mais recentes. Formato: $ git log -p -x
$ git log -p -2             # mostra o conteúdo dos dois commits mais recentes


# --stat: mostra de forma resumida as alterações de cada commit, como quais arquivos mudaram, quantas linhas foram removidas e quantas adicionadas
$ git log --stat

# --pretty: exibe as informações em um formato diferente do padrão
$ git log --pretty=oneline              # cada commit em uma linha

$ git log --pretty=format:"%h - %an, %ar : %s"  
# Resultado: 1a99c42 - 苏, 19 hours ago : commit sem importância


```
**Escrita e significado dos placeholders mais usados com `format`**

|Opção	|Descrição|
|---|---|
|%H|Hash completo do objeto commit|
|%h|Hash abreviado do objeto commit|
|%T|Hash completo do objeto tree|
|%t|Hash abreviado do objeto tree|
|%P|Hash completo do(s) objeto(s) pai (parent)|
|%p|Hash abreviado do(s) objeto(s) pai|
|%an|Nome do autor (author)|
|%ae|E-mail do autor|
|%ad|Data do autor (o formato pode ser personalizado com a opção --date=)|
|%ar|Data do autor, em formato relativo (há quanto tempo)|
|%cn|Nome de quem fez o commit (committer)|
|%ce|E-mail de quem fez o commit|
|%cd|Data do commit|
|%cr|Data do commit, em formato relativo (há quanto tempo)|
|%s|Mensagem do commit|

---

**Exibir graficamente o histórico de merges dos branches**
```
$ git log --graph --oneline   # o oneline só deixa a saída mais agradável de ler
```

---

**Outras opções do git log**

|Opção	|Descrição|
|---|---|
|-p|Mostra, em formato de patch, as diferenças introduzidas por cada commit.|
|--stat|Mostra estatísticas de arquivos modificados em cada commit.|
|--shortstat|Mostra apenas a última linha do --stat, com o total de linhas alteradas, adicionadas e removidas.|
|--name-only|Mostra a lista de arquivos modificados logo após as informações do commit.|
|--name-status|Mostra a lista de arquivos adicionados, modificados e excluídos.|
|--abbrev-commit|Mostra apenas os primeiros caracteres do SHA-1, em vez de todos os 40.|
|--relative-date|Mostra a data em formato relativo e mais curto (por exemplo, "2 weeks ago").|
|--graph|Mostra um gráfico ASCII do histórico de branches e merges.|
|--pretty|Mostra os commits em outro formato. As opções disponíveis incluem oneline, short, full, fuller e format (seguido do formato desejado).|


**Encontrar os commits que adicionaram ou removeram uma string**

```
# Use o limitador -S seguido imediatamente da string a procurar
$ git log -Smethod_name

# Ou, para buscar os commits que alteraram um arquivo, basta acrescentar o nome do arquivo no final
$ git log fileName
```

Haha, mesmo que você escreva sem querer um bug escondido, não importa se meses depois: se o chefe quiser descobrir quem causou o problema, é bem simples. Por exemplo, assim:
`$ git log -p fileName`. Quer jogar a culpa em outra pessoa? Esquece, é melhor admitir o erro e prestar mais atenção da próxima vez.

**Mais algumas opções que limitam a saída do log**



|Opção|	Descrição|
|---|---|
|-(n)|Mostra apenas os n commits mais recentes|
|--since, --after|Mostra apenas os commits feitos depois da data indicada.|
|--until, --before|Mostra apenas os commits feitos antes da data indicada.|
|--author|Mostra apenas os commits do autor indicado.|
|--committer|Mostra apenas os commits de quem fez o commit (committer) indicado.|
|--grep|Mostra apenas os commits cuja mensagem contém a palavra-chave indicada|
|-S|Mostra apenas os commits que adicionaram ou removeram a palavra-chave indicada|

Um exemplo prático: para ver, em um repositório Git, os commits do autor chamado 苏 (Su) entre 1º e 7 de novembro de 2016, use o comando abaixo:

```
git log --pretty="%h - %s" --author=苏 --since="2016-11-01" \
   --before="2016-11-07"
```

<span id = "desfazer-operações"></span>
### Desfazer operações

**Refazer o commit com amend**

Quando, depois de um `commit`, percebemos de repente que esquecemos um arquivo, não faz sentido fazer mais um `commit` só para esse arquivo; seria redundante. E voltar a versão para adicioná-lo antes também é trabalhoso. Nessa hora, dá para usar o comando `amend`, assim:


```
$ git commit -m "版本1.5开发代码"

# Bem quando você respira aliviado, percebe que esqueceu de alterar o arquivo de configuração; você o altera depressa e o adiciona à área de stage com add
$ git add project.property
$ git commit --amend         
# Você vai ver, como mágica, que sem nenhuma operação extra o arquivo esquecido foi incluído no último commit
```
---

**Tirar arquivos da área de stage**

Ou seja, arquivos em que você já fez `git add`. Nesse caso, dá para usar `reset`


```
# Faz o arquivo da área de stage voltar ao estado "modificado, mas não adicionado à área de stage"
$ git reset HEAD fileName
```

**Desfazer as alterações de um arquivo**

Cenário: o arquivo foi modificado, mas ainda não houve `git add`, então a alteração está só no diretório de trabalho; queremos restaurá-lo para o conteúdo do último commit


```
$ git checkout -- filename
```
Use com cuidado: antes de usar, tenha certeza de que quer descartar o que adicionou, porque essa ação pode fazer seu conteúdo mais recente se perder de vez, já que não houve `commit`. Em geral, o que já passou por `commit` pode ser recuperado.


<span id = "tags"></span>
### Tags

>O Git permite marcar com uma tag um commit do histórico, para indicar que ele é importante. Por exemplo, cada lançamento de versão oficial.

**Listar tags**


```
$ git tag

# Se você só se interessa por parte das tags, por exemplo apenas pelas tags v2.x, pode fazer assim
$ git tag -l 'v2.*'
```

---

**Criar tags**

Há dois tipos de tag: a `tag anotada` e a `tag leve`.

* Tag anotada: guarda as informações de quem criou a tag, a data e uma mensagem, e aponta para o commit marcado
* Tag leve: é apenas uma marcação em um commit. Fica armazenada em um arquivo dedicado a tags e aponta para o hash do commit

Primeiro, a tag anotada:


```
$ git tag -a v1.0 -m '附加信息'
```

Tag leve


```
$ git tag v1.0
```

Criar tags depois, ou seja, adicionar uma tag a um commit já feito


```
# Primeiro você pode usar git log --oneline para obter os hashes do histórico de commits
$ git log --oneline

# Depois, coloque o hash no final do comando de tag
$ git tag -a v1.1 a6b4c97
```

**Compartilhar tags**

Por padrão, o `git push` não envia as tags para o servidor remoto. É preciso enviar as tags explicitamente para compartilhá-las no servidor.
Por exemplo: `git push origin [tagname]`

```
$ git push origin v1.4

# Para enviar ao servidor remoto todas as tags locais que ainda não existem lá, faça assim
$ git push origin --tags
```
---

**Fazer checkout de uma tag**

No git não é possível fazer um checkout de verdade de uma tag (para trabalhar nela), mas é possível criar um novo branch a partir da tag, como abaixo


```
$ git checkout -b checkbranch2 v2.0
```
---

**Ver as informações de uma tag**

Use `git show <nome da tag>` para ver os detalhes da tag. Um `git show` sem argumentos apenas mostra o conteúdo do último commit

```
$ git show v1.4
```


<span id = "operações-com-branches"></span>
## Operações com branches

<span id = "criar-branches"></span>
### Criar branches

Criar um branch é, na essência, criar um ponteiro móvel; o nome desse ponteiro é o nome do novo branch


```
$ git branch dev

# O comando acima apenas cria o branch, sem trocar para ele. Dá para criar e trocar para o novo branch com um único comando
$ git checkout -b dev

# Com o comando `git log` dá para ver para qual objeto cada branch aponta
$ git log --oneline --decorate

# Se quiser ver o histórico de bifurcações em forma de gráfico, faça assim:
$ git log --oneline --decorate --graph --all
```

<span id = "trocar-de-branch"></span>
### Trocar de branch

Trocar de branch nada mais é do que mudar para onde o ponteiro `HEAD` aponta


```
$ git checkout dev
```

<span id = "mesclar-branches"></span>
### Mesclar branches

Com `git merge <branch a ser mesclado>`, o conteúdo do branch indicado é mesclado no branch em que você está. Dá para entender assim: se o branch atual é ancestral direto do branch indicado (ou seja, seguindo o histórico do branch atual se chega a ele), então, na essência, o ponteiro atual apenas avança. Como nesse caso o merge não tem divergências a resolver, o git chama isso de `fast-forward` (avanço rápido).


```
git merge dev
```

<span id = "excluir-branches"></span>
### Excluir branches

Quando o desenvolvimento de um branch de funcionalidade termina e ele é mesclado, normalmente esse branch é excluído, para manter o repositório limpo.


```
# Exclui o branch dev
$ git branch -d dev

# Se o branch dev tiver trabalho que ainda não foi mesclado, por segurança o git não permite excluí-lo por padrão; use `-D` para forçar a exclusão
$ git branch -D dev

```

<span id = "gerenciar-branches"></span>
### Gerenciar branches

O comando `git branch` não serve apenas para criar e excluir branches. Sem nenhum parâmetro, ele mostra uma lista de todos os branches

```
$ git branch        # o * na frente de um branch indica o branch atualmente em checkout, ou seja, o branch para onde o HEAD aponta

# Com o parâmetro -v, mostra o último commit de cada branch
$ git branch -v

# --merged: mostra quais branches já foram mesclados no branch atual
$ git branch --merged        # em geral, os branches desta lista, exceto o marcado com *, podem ser excluídos

# --no-merged: mostra todos os branches que contêm trabalho ainda não mesclado
$ git branch --no-merged
```


<span id = "rebase"></span>
### Rebase

> Assim como o `merge`, o efeito é integrar branches, mas usar o `rebase` deixa o histórico de commits mais limpo. Veja abaixo

![](../../project/git/rebase_1.png)
![](../../project/git/rebase_2.png)

A imagem 1 mostra o resultado do `merge`, e a imagem 2, o resultado do `rebase`. Claramente o rebase deixa o histórico de commits com uma aparência mais limpa. Uso:


```
# rebase <branch de destino (base)> [branch cuja base será movida]
$ git rebase master experiment

# Agora os commits do outro branch ficam depois do branch de destino. Basta trocar para o branch master e fazer o merge
$ git checkout master
$ git merge experiment

```

O princípio do `rebase` é o seguinte: a partir do branch de destino e do branch a ser rebaseado, procura-se o ancestral comum, que aqui é o `c2`. Em seguida, todos os commits do branch a ser rebaseado desde o `c2` têm suas alterações extraídas e copiadas, e são aplicados depois do branch de destino, criando os commits correspondentes. Assim, o branch rebaseado passa a apontar para um commit posterior ao `branch de destino master`. Depois, basta usar `merge` para avançar o ponteiro do `master`.


<span id = "branches-remotos"></span>
### Branches remotos


```
# Lista as referências (branches, tags etc.) do repositório remoto
$ git ls-remote origin

# Se quiser mais informações
$ git remote show origin

# Mostra os branches remotos e os locais
$ git branch -a
```

---

**Trazer um branch remoto**

Suponha que no remoto exista um branch `dev` e você faça `fetch` para buscá-lo. Nesse caso, não é criada automaticamente uma cópia local editável; em outras palavras, não haverá um novo branch local `dev`, apenas um ponteiro `origin/dev`, que não pode ser modificado. Aí você pode executar `git merge origin/dev` para mesclar o trabalho desse branch dev remoto no branch atual. Se quiser trabalhar no seu próprio branch dev local, pode criá-lo a partir do branch remoto.


```
$ git checkout -b dev origin/dev
```

---

**Criar um branch remoto**

Se você tem localmente um branch `dev` novo, fez commits nele e agora quer enviá-lo para um branch `dev` remoto, mas o remoto ainda não tem um `dev`, use o comando: `git push <nome do repositório remoto> <branch local a ser enviado>`


```
$ git push origin dev
```

---

**Excluir um branch remoto**


```
# Exclui o branch dev remoto
$ git push origin --delete dev
```

<span id = "branches-de-rastreamento"></span>
### Branches de rastreamento

Fazer checkout de um branch local a partir de um branch remoto cria automaticamente o chamado `branch de rastreamento` (às vezes também chamado de "branch upstream"). Um branch de rastreamento é um branch local que tem relação direta com um branch remoto. Se você digitar `git pull` em um branch de rastreamento, o `Git` sabe automaticamente de qual servidor buscar e em qual branch mesclar.

Ao clonar um repositório, normalmente é criado automaticamente um branch `master` que rastreia `origin/master`. Mas, se quiser, você pode configurar outros branches de rastreamento: branches que rastreiam branches de outros repositórios remotos, ou que não rastreiam o `master`. O caso mais simples é o exemplo visto antes: executar `git checkout -b [branch] [remotename]/[branch]`. Como essa operação é muito comum, o Git oferece o atalho `--track`:


```
$ git checkout --track origin/dev

# Se quiser um nome personalizado para o branch local
$ git checkout -b 任意分支名字 origin/dev
```

---

**Para fazer um branch local existente rastrear um branch remoto recém-baixado**, ou para mudar o branch upstream que está sendo rastreado, você pode, a qualquer momento, executar git branch com a opção -u ou --set-upstream-to para definir isso explicitamente.


```
# Define o upstream do branch para onde o HEAD aponta como o branch dev remoto
$ git branch -u origin/dev
```

---

**Ver todos os branches de rastreamento configurados**


```
$ git branch -vv
```

<span id = "operações-com-repositórios-remotos"></span>
## Operações com repositórios remotos


<span id = "clonar-um-repositório"></span>
### Clonar um repositório


```
$ git clone <url>

# Se quiser dar seu próprio nome ao repositório, ou seja, o nome da pasta raiz local, acrescente o nome assim
$ git clone <url> [dirName]
```

<span id = "ver-os-repositórios-remotos"></span>
### Ver os repositórios remotos


```
# Forma padrão de listar os repositórios remotos
$ git remote

# Mostra as URLs usadas para leitura (fetch) e escrita (push) de cada remoto
$ git remote -v
```

Se precisar de mais informações sobre um repositório específico, use `git remote show ...`

```
$ git remote show origin
```

<span id = "adicionar-um-repositório-remoto"></span>
### Adicionar um repositório remoto


```
# Formato: git remote add [shortName] <url>  ao mesmo tempo, você define um nome de referência para o repositório, por exemplo
$ git remote add rp git@github.com:suzeyu1992/GitOperateDemo.git

# Agora, para buscar do novo remoto, basta usar o nome de referência definido
$ git fetch rp

```

<span id = "pull-e-push-com-repositórios-remotos"></span>
### Pull e push com repositórios remotos

**Pull (trazer)**

O mais usado costuma ser o comando `git pull`. Ele normalmente busca os dados do servidor e tenta mesclá-los automaticamente no branch atual.

Também podemos usar `git fetch` para buscar os commits do branch remoto rastreado pelo branch local que ainda não temos, sem mesclar. Depois, podemos fazer o merge manualmente.

**Push (enviar)**

`git push [remote-name] [branch-name]` por exemplo:

```
$ git push origin master
```

Esse comando só funciona se você tiver permissão de escrita no servidor e se ninguém tiver enviado (push) alterações nesse meio-tempo.

Tanto no push quanto no pull acima: se o branch atual tiver configurado o rastreamento de um branch do servidor remoto, é possível omitir o nome do repositório e o nome do branch. Se não tiver, é preciso informá-los explicitamente.



<span id = "remover-e-renomear-repositórios-remotos"></span>
### Remover e renomear repositórios remotos

Para alterar o nome de um repositório remoto

```
$ git remote rename oldName newName
```

Para remover um repositório remoto, por exemplo porque o servidor mudou, porque um determinado espelho não é mais usado ou porque um colaborador não contribui mais


```
$ git remote rm 仓库名
```
