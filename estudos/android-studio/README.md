> Tradução para português de [project/AS/README.md](../../project/AS/README.md).

> Compilação de pequenos truques de atalho do `AS` (Android Studio), reunidos a partir do livro `Android群英传` (Android Heroes) e de materiais mais completos encontrados na internet. A versão `mac` foi testada, e a maior parte da versão `win` também. No final há uma `tabela de atalhos` completa. Seja no Windows ou no Mac, se algum atalho tiver sido alterado ou não funcionar, é possível redefini-lo pela `palavra-chave no Keymap` indicada.
>  Se algum `gif` das imagens não estiver nítido, basta ampliar a página.

O(∩_∩)O~~ Se gostou, deixe uma estrela. Ao republicar, cite a fonte [https://github.com/suzeyu1992/repo](https://github.com/suzeyu1992/repo)


* [Pequenas operações do dia a dia](#1)
    * [Seleção de palavras](#2)
    * [Exibir arquivos abertos e modificados recentemente](#3)
    * [Busca de arquivos](#4)
    * [Histórico de navegação](#5)
    * [Mover linhas](#6)
    * [Encontrar onde um método é chamado](#7)
    * [Seguir a implementação de métodos](#8)
    * [Exibir os parâmetros de um método](#9)
    * [Operações rápidas com linhas](#10)
    * [Operações em várias linhas](#11)
    * [Completar instrução rapidamente](#12)
    * [Sugestões de código](#13)
    * [Operações rápidas com variáveis](#14)
    * [Recolher código](#15)
    * [Pré-visualizar a definição de um método](#16)
    * [Gerenciamento da área de transferência](#17)
    * [Dividir a janela](#18)
    * [Estilo de nomenclatura de variáveis](#19)
    * [Ver a estrutura (outline)](#20)
    * [Marcadores (bookmarks)](#21)
* [Refatoração rápida](#22)
    * [Ponto de entrada da refatoração](#23)
    * [surround with](#24)
    * [Extract](#25)
* [Modelos de código](#26)
* [Análise de código](#27)
    * [Insepect Code & Code cleanup](#28)
    * [Dependencies](#29)
    * [Pilha de chamadas de métodos](#30)
* [Depuração com breakpoints](#31)
    * [Depuração rápida](#32)
* [Tabela de consulta de atalhos](#33)

<a name="1"/>
## Pequenas operações do dia a dia

<a name="2"/>
### Seleção de palavras

Em geral, as `IDEs` usam `option + seta esquerda/direita` (no Windows, `ctrl + seta esquerda/direita`) para fazer o cursor saltar de palavra em palavra. Porém, como usamos muito a nomenclatura camelCase, o comportamento padrão salta do início ao fim de um nome camelCase inteiro, composto de várias palavras. Felizmente, o `AS` permite configurar esse comportamento.

**Comportamento padrão**

![](../../project/AS/img/smart_old.gif)

**Comportamento após a alteração**

![](../../project/AS/img/smart_new.gif)


**Passos para alterar**

Abra as **Preferências** e configure conforme a imagem

![](../../project/AS/img/smart.png)

> Embora pular entre as palavras fique ótimo, quando você der um duplo clique para copiar o nome da variável, apenas uma das palavras do nome será copiada, e não a string completa delimitada por espaços, como antes. Eu, pelo menos, usei por menos de um dia, achei desconfortável e voltei ao estilo original.
> Mas, depois que você se acostuma com o truque `option + seta esquerda/direita`, fica muito mais eficiente do que clicar com o mouse ou mover o cursor caractere por caractere até a posição desejada.

<a name="3"/>
### Exibir arquivos abertos e modificados recentemente

Por exemplo: abri o arquivo de layout `main_activity.xml` e depois fechei a aba. Nesse momento, com `Command + E`, os arquivos com que trabalhei antes são exibidos assim:

![](../../project/AS/img/recent_file.png)


E, se quiser ver os arquivos modificados anteriormente, basta usar `Command + Shift + E`. Pode ser combinado com `Control + Tab` para alternar rapidamente entre as telas.

**Atalhos**

* Abertos recentemente
    * `Command + E` **(mac)**
    * `ctrl + E` **(win)**
* Modificados recentemente
    * `Command + Shift + E`  **(mac)**
    * `ctrl + shift + E` **(win)**


<a name="4"/>
### Busca de arquivos



`search Everywhere`

Função de busca global de arquivos no projeto

**Buscar classes**

* `command + o` **(mac)**
* `ctrl + n` **(win)**

Por padrão, a busca de classes acontece apenas no código do projeto. Se precisar buscar classes do `sdk` ou de bibliotecas, pressione o atalho mais uma vez, ou marque a opção mostrada na imagem abaixo para buscar classes em todo o escopo

![](../../project/AS/img/find_class.png)

---

**Buscar arquivos**

Este nível é mais amplo que o anterior. Inclui todos os arquivos, como `xml` etc.

* `command + shift + o` **(mac)**
* `ctrl + shift + n` **(win)**

Como acima, se precisar buscar em bibliotecas ou no código-fonte, pressione o atalho mais uma vez, ou marque a opção mostrada na imagem de `buscar classes`.


<a name="5"/>
### Histórico de navegação

Ao navegar pela estrutura do código, é comum ir entrando em várias classes; se quiser voltar ao ponto de navegação anterior, este é um atalho que você precisa memorizar.

* `Command + Option + Left\Right` ou `command + [`, `command + ]` **(mac)**
* `ctrl + alt + Left\Right`**(win)**

<a name="6"/>
### Mover linhas

Dispensa muita explicação: move a **linha inteira** para cima ou para baixo.

* `Option + shift + seta para cima\seta para baixo` **(mac)**
* `alt + shift + seta para cima\seta para baixo` **(win)**

<a name="7"/>
### Encontrar onde um método é chamado

Cenário: descobrir onde um método é chamado, ou onde um ID é referenciado. Selecione o método, clique com o **botão direito** e escolha `Find Usages`.

Atalho:

* `option + F7` **(mac)**
* `alt + F7` **(win)**

<a name="8"/>
### Seguir a implementação de métodos

Métodos sempre envolvem saltos, e frequentemente queremos ver os detalhes internos de um método. A forma mais comum é `segurar Command e clicar no nome do método`.

Também é possível, com o cursor posicionado, entrar diretamente no método com `Command + B`.

* `Command + B` **(mac)**
* `ctrl + alt + B` **(win)**

<a name="9"/>
### Exibir os parâmetros de um método

Quando usamos um método, todos os parâmetros são exibidos no início, mas depois de um tempo a dica pode desaparecer. Nesse momento, se quiser saber de que tipo é o próximo parâmetro, ou ver todos os parâmetros:

![](../../project/AS/img/params.gif)

Atalho:

* `command + P` **(mac)**
* `ctrl + P` **(win)**

Se quiser ver a documentação do método sem abrir o código-fonte, basta pressionar `F1` para exibi-la.


<a name="10"/>
### Operações rápidas com linhas

Para apagar uma linha rapidamente, basta usar a função de recortar, `Command + X`

**Duplicar linha rapidamente**: use `command + D` **mac**, `ctrl + D` **win**


<a name="11"/>
### Operações em várias linhas

Às vezes declaramos uma série de variáveis relacionadas como `float`, mas na verdade precisamos de `int`. Nesse caso, dá para usar a `seleção múltipla` para alterar tudo de uma vez. Veja a imagem abaixo:

![](../../project/AS/img/mul_condition.gif)

Segure a tecla `option` (no Windows, `alt`) e selecione a área com o mouse. Depois, faça a alteração correspondente.

Você pode pensar que o método acima só funciona com linhas contíguas. E se fosse possível definir `vários cursores`, isso resolveria o seu problema?

Veja a imagem abaixo:

![](../../project/AS/img/mul_no_condition.gif)

* `option + shift + clique do mouse` **(mac)**
* `alt + shift + clique do mouse`**(win)**

Assim você adiciona um `cursor de edição`. No fim, quando não precisar mais deles, pressione `esc` para fechar os cursores extras.

<a name="12"/>
### Completar instrução rapidamente

Ao criar um objeto, ou com `findViewById()`, às vezes é preciso mover o mouse ou o cursor até o final da linha para completar o `ponto e vírgula`. Tudo isso pode ser resolvido com um atalho. Depois que você se acostuma, fica muito prático.

* `command + shift + enter`**(mac)**
* `ctrl + shift + enter`**(win)**

Funções realizadas

* Adiciona as chaves do corpo do método
* Adiciona o ponto e vírgula no final da linha
* Formata automaticamente a linha, entre outras operações


<a name="13"/>
### Sugestões de código

Sugestões de código que podem ser chamadas em qualquer lugar.

`control + option + /` (não é o padrão; o padrão no mac é `control + space`). O que vale destacar aqui: depois da sugestão de código, normalmente confirmamos com a tecla `Enter`. Ao pressionar `Enter`, o conteúdo depois do cursor é mantido. Às vezes não queremos isso; nesse caso, use a tecla `Tab` para escolher a sugestão, e ela apagará o conteúdo que vinha depois.

No Windows, o atalho é `ctrl + espaço` (no Windows também costuma conflitar com o método de entrada; nas configurações do AS, procure manualmente `completion basic` no item `keymap` e altere o atalho)

![](../../project/AS/img/tip.gif)


**Gerar variáveis rapidamente**

Por exemplo, dentro do corpo de um método, digitar `logi` gera rapidamente um modelo de saída de `log`, mas a constante `TAG` ainda não foi declarada. Nesse momento, posicione o cursor sobre `TAG` e use o atalho de sugestão para gerá-la rapidamente.

* `option + enter`**(mac)**
* `alt + enter`**(win)**

<a name="14"/>
### Operações rápidas com variáveis

![](../../project/AS/img/filed.gif)

Na imagem acima, o atalho foi usado duas vezes:

* Primeira: salta para o `local de declaração` da variável
    * `command + B` **(mac)**
    * `ctrl + b`  **(win)**
* Segunda: salta para o `local de definição` do tipo da variável
    * `command + shift + B` **(mac)**
    * `ctrl + shift + b` **(win)**


<a name="15"/>
### Recolher código

Recolhe e expande blocos de código.

* `command + sinal de mais\sinal de menos`**(mac)**
* `ctrl + sinal de mais\sinal de menos` **(win)**

<a name="16"/>
### Pré-visualizar a definição de um método

Se quiser apenas ter uma ideia geral da definição de um método, sem saltar para a classe de código-fonte onde ele está, use `Command + Y` (no Windows, o atalho é `ctrl + shift + I`) para pré-visualizar

![](../../project/AS/img/method_pre.png)


<a name="17"/>
### Gerenciamento da área de transferência

Ao copiar e colar, estamos acostumados a um `único` `c+v`. Mas, se quiser ver conteúdos `copiados anteriormente` que já foram sobrescritos, o `AS` também tem uma `área de transferência` para gerenciá-los, mostrando os últimos itens copiados.

![](../../project/AS/img/command_copy.png)

* `command + shift + v` **(mac)**
* `ctrl + shift + v`    **(win)**

<a name="18"/>
### Dividir a janela

![](../../project/AS/img/split.png)

Basta clicar com o `botão direito` na aba e escolher `split vertical\horizontal`.



<a name="19"/>
### Estilo de nomenclatura de variáveis

`Variáveis de instância` devem começar com `m`. `Membros estáticos` normalmente começam com `s`. Esse estilo pode ser configurado assim:

![](../../project/AS/img/set_name.png)

Assim, ao digitar o nome de uma variável, o `m` ou o `s` é completado automaticamente. Além disso, ao usar `Extra` (extrair) no código, o código gerado é refatorado automaticamente segundo essa regra.

<a name="20"/>
### Ver a estrutura (outline)

Quando uma classe é muito grande, você pode abrir a tela de estrutura com `command + F12` (no Windows, `ctrl + F12`), que exibe a lista de todos os métodos e variáveis de instância.

![](../../project/AS/img/all_body.png)

Ela também suporta busca aproximada (fuzzy) para filtrar o que é exibido, permitindo encontrar rapidamente os métodos procurados.


<a name="21"/>
### Marcadores (bookmarks)

Ao navegar por códigos grandes ou durante a depuração, às vezes é preciso lembrar de alguns trechos ou métodos importantes. Para isso, use os `marcadores` para registrar esse código. Basta clicar na linha que deseja marcar e pressionar `F3`; um `pequeno visto` aparecerá à esquerda, indicando que o marcador foi adicionado.

Também é possível encontrar os `Bookmarks` correspondentes na aba `Favorites`.

Com o atalho `command + F3` (no Windows, `shift + F11`), o painel de marcadores é aberto rapidamente para as demais operações.


<a name="22"/>
## Refatoração rápida

<a name="23"/>
### Ponto de entrada da refatoração

Quando um trecho de código vai ser refatorado, você pode usar `control + T` (no Windows, `ctrl + alt + shift + T`) para abrir o ponto de entrada da refatoração. Ou `clicar com o botão direito` e escolher `Refactor` para exibir a tela de refatoração.

Há muitas funções práticas ali, como extrair métodos etc.

<a name="24"/>
### surround With

Quando quiser envolver um trecho de código com uma condição, captura de exceção, laço, Runnable etc., é possível fazer isso diretamente por um atalho, sem precisar criar a condição manualmente e depois `copiar e colar` o bloco de código

![](../../project/AS/img/runnable.gif)

Atalho

* `command + option + T`**(mac)**
* `ctrl + alt + T`**(win)**

<a name="25"/>
### Extract

Você pode usá-lo com frequência para extrair um método.

![](../../project/AS/img/extract_method.gif)

E não só isso: também é possível extrair atributos iguais de vários componentes em um `xml` para um `style`

![](../../project/AS/img/extract_xml.gif)

Não é ótimo?

E isso é só uma parte: no `xml`, além de extrair `Style`, também é possível extrair um layout (`Layout`).

Já no código, é possível extrair todo tipo de variável, parâmetro e constante.


<a name="26"/>
## Modelos de código

O `AS` já vem com muitos modelos de código embutidos, permitindo escrever num piscar de olhos aquele código que você já sabe de cor. Veja uma pequena parte abaixo

![](../../project/AS/img/template.gif)

Esses modelos de código podem ser chamados pelo atalho

* `command + J`**(mac)**
* `ctrl + J`**(win)**

<a name="27"/>
## Análise de código

O `Google` oferece muitas ferramentas de análise de código, todas reunidas em `Analyze`, na barra de menus superior.

<a name="28"/>
### Inspect Code & Code cleanup

`Inspect Code` faz a `IDE` analisar o projeto inteiro, de forma semelhante à análise do `Lint`, e apresenta sugestões gerais de correção etc.

A função `Code cleanup` faz correções automáticas no código.

<a name="29"/>
### Dependencies

Com as opções `Dependencies` em `Analyze`, é possível analisar rapidamente as dependências do projeto.

<a name="30"/>
### Pilha de chamadas de métodos

Para certos métodos, é muito importante ver onde eles são chamados e em que ordem. Use `control + option + H` para consultar rapidamente a pilha de chamadas do método.

<a name="31"/>
## Depuração com breakpoints

<a name="32"/>
### Breakpoints rápidos

`Breakpoint condicional`. Usado principalmente dentro de laços. Por exemplo, num `for` que executa 10 vezes, você quer parar no breakpoint apenas na `8ª` iteração.

Assim como num `breakpoint comum`, primeiro crie um breakpoint. Depois, `clique com o botão direito do mouse` sobre o `breakpoint comum` e preencha a condição no menu que aparece. Veja:

![](../../project/AS/img/condition.gif)

Na imagem acima, `Enable` controla se o breakpoint está `ativado` ou `desativado`.

---

`Breakpoint temporário`. Se precisar de um breakpoint que seja executado só uma vez e removido automaticamente depois, use o atalho para transformar a linha atual em um breakpoint temporário.

![](../../project/AS/img/one_debug.png)

* `command + option + shift + F8`
* `ctrl + alt + shift + F8`


Para não alongar demais o texto, a parte de depuração fica com o link de um post que explica tudo em detalhes

* [Android Studio代码调试大全 (Guia completo de depuração de código no Android Studio)](http://blog.csdn.net/dd864140130/article/details/51560664)



<a name="33"/>
## Tabela de consulta de atalhos

A tabela lista o nome de cada atalho no `keymap`. Você pode buscar `keymap` diretamente na tela `AS setting` e adicionar ou alterar o atalho pelo nome correspondente.


| Descrição da função | Nome no keymap | Mac | Win/Linux |
| --- | --- | --- | --- |
| **Sugerir soluções para erros** | **Show Intention Actions** | `option + enter` | `alt + enter` |
| **Tela de configurações do AS** | **Preferences** | `command + ,` | `control+alt+S` |
| **Tela de configuração do projeto** | **Project Structure** | `command + ;` | `Control＋Alt+Shift+S` |
| **Gerar código rapidamente** | **Code Generate** | `command + N` | `alt + insert` |
| **Sugestões de código** | **Completion/Basic** | `control + space`(no mac há conflito, altere manualmente) | `ctrl + espaço`(no Windows também costuma conflitar com o método de entrada, altere manualmente) |
| **Selecionar na visualização** | **select in any view** | `option + F1` | `alt + F1` |
| **Adicionar marcador** | **Toggle Bookmark** | `option + F3` | `ctrl + F11` |
| **Mover uma linha para baixo** | **Move Line Down** | `option + shift + Down` | `alt + shift + Down` |
| **Mover uma linha para cima** | **Move Line Up**  | `option + shift + Up` | `alt + shift + Up` |
| **Comentar código** | **Comment with Line Comment** | `command + /` | `ctrl + /` |
| **Envolver código com modelo** | **surround with Live Template** | `command + option + J` | `ctrl + alt + J` |
| **Formatar código** | **Reformat Code** | `command + option + L` | `ctrl + alt + L` |
| **Copy Reference** | **Copy Reference** | `command + option + shift + C` | `ctrl + alt + shift + C` |
| **Envolver código com if/try etc.** | **Surround With..** | `command + option + T` | `ctrl + alt + T` |
| **Ver declaração** | **Declaration** | `command + B` | `ctrl + B` |
| **Duplicar linha para baixo** | **Duplicate Line or Block** | `command + D` | `ctrl + D` |
| **Apagar linha** | **Delete Line** | `command + delete` | `ctrl + Y` |
| **Abertos recentemente** | **Recent Files** | `command + E` | `ctrl + E` |
| **Localizar** | **Edit/Find/Find** | `command + F` | `ctrl + F` |
| **Estrutura de métodos do arquivo** | **File Structure** | `command + F12` | `ctrl + F12` |
| **Exibir marcadores** | **Show Bookmarks** | `command + F3` | `shift + F11` |
| **Próxima ocorrência destacada** | **Move To Next Occurrence** | `command + G` | `F3` |
| **Ocorrência destacada anterior** | **Move To Previous Occurrence** | `command + shift + G` | `shift + F3` |
| **Gerar código a partir de modelo** | **Insert Live Template** | `command + J` | `ctrl + J` |
| **Ir para a linha** | **Navigate/Line** | `command + L` | `ctrl + G` |
| **Ir ao início/fim da linha** | **Move Caret to Line Start/End** | `command + Left/Right` | `ctrl + Left/Right` |
| **Recolher/expandir código** | **Collapse/Expand** | `command + sinal de menos/sinal de mais` | `ctrl + sinal de menos/sinal de mais` |
| **Buscar classe** | **Navigate/Class** | `command + O` | `ctrl + N` |
| **Comentário de várias linhas** | **Code/Comment ** | `command + option + /` | `ctrl + alt + /` |
| **Formatar código** | **Reformat Code** | `command + option + L` | `ctrl + alt + L` |
| **Mostrar tipos dos parâmetros** | **Parameter Info** | `command + P` | `ctrl + P` |
| **Localizar e substituir** | **Replace** | `command + R` | `ctrl + R` |
| **Buscar comando** | **Find Action** | `command + shift + A` | `ctrl + shift + A` |
| **Copiar caminho do arquivo** | **Copy Paths** | `command + shift + C` | `ctrl + shift + C` |
| **Mover bloco de código** | **Move Statement Up/Down** | `command + shift + down/up` | `ctrl + shift + down/up` |
| **Completar código** | **Complete Current Statement** | `command + shift + enter` | `ctrl + shift + enter` |
| **Buscar em todos os caminhos** | **Find in Path** | `command + shift + F` | `ctrl + shift + F` |
| **Destacar código** | **Highlight Usages in File** | `command + shift + F7` | `alt + J` |
| **Recolher/expandir todo o código da janela** | **Collapse/Expand All** | `command + shift + sinal de menos/sinal de mais` | `ctrl + shift + sinal de menos/sinal de mais` |
| **Buscar arquivo** | **Navigate/File** | `command + shift + O` | `ctrl + shift + N` |
| **Substituir em todos os caminhos** | **Replace in Path** | `command + shift + R` | `ctrl + shift + R` |
| **Alternar maiúsculas/minúsculas** | **Toggle Case** | `command + shift + U` | `ctrl + shift + U` |
| **Exibir histórico da área de transferência** | **Paste from History** | `command + shift + V` | `ctrl + shift + V` |
| **Ver definição rapidamente** |  | `command + space` | `ctrl + shift + I` |
| **Colar** | **Paste** | `command + V` | `ctrl + V` |
| **Copiar** | **Copy** | `command + C` | `ctrl + C` |
| **Remover imports não utilizados** | **Optimize Imports** | `control + option + O` | `ctrl + alt + O` |
| **Exibir hierarquia de herança da classe** | **Type Hierarchy** | `control + H` | `ctrl + H` |
| **Sobrescrever métodos rapidamente** | **override Methods** | `control + O` | `ctrl + O` |
| **Encontrar onde é chamado** | **Call hierarchy** | `control + option + H` | `ctrl + alt + H` |
| **Adicionar marcador** | **Toggle Bookmark** | `F3` | `F11` |
| **Expandir/reduzir a seleção** | **Extend Selection/Shrink Selection** | `option + UP/Down` | `ctrl + W + shift + W` |
| **Ir para a superclasse** | **Super method** | `command + U` | `ctrl + U` |
| **Fechar a aba atual** | **Editor Tabs / Close** | `command + W` | `ctrl + shift + a` |
| **Fechar todas as janelas exceto o editor** | **Hide All Tool Windows** | `command + shift + F12` | `ctrl + shift + F12` |
| **Pré-visualizar definição do método** | **Quick Definition** | `command + Y` | `ctrl + shift + I` |
| **Voltar ao último local editado** | **Last Edit Location** | `command + shift + delete` | `control + shift + Backspace` |
| **Ir ao início/fim do bloco de código** | **Move Caret To Code Block** | `Option + Command + [ ou ]` | `Control+[ ou ]` |
| **Renomear** | **Rename** | `shift + F6` | `shift + F6` |
| **Extrair método** | **Extract Method** | `command + option + M` | `control+alt+M` |
| **Extrair variável** | **Extract Variable** | `command + option + V` | `control+alt+V` |
| **Extrair campo** | **Extract Field** | `command + option + F` | `control+alt+F` |
| **Extrair constante** | **Extract Constant** | `command + option + C` | `control+alt+C` |
| **Extrair parâmetro** | **Extract Parameter** | `command + option + P` | `control+alt+P` |
| **Ponto de entrada da refatoração** | **Refactor This** | `control + T` | `ctrl + alt + shift + T` |




* [GitHub do autor](https://github.com/suzeyu1992/repo.git)
